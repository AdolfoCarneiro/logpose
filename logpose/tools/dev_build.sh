# shellcheck shell=bash
# Build incremental de desenvolvimento, rodado dentro do logpose-dev depois de `source scripts/dev.sh`.
# Uso pelo logpose/bin/logpose-build; não chame direto.

_applied="${_build_dir}/applied-patches"
_brand_backup="${_build_dir}/logpose-namesubs.tar.gz"

# args do out/Default, que serve pra testar e pra empacotar: binário único (o pacote não leva .so de
# component build), sem LTO do official build pra o link incremental levar minutos, e sem símbolos
# pra ocupar pouco disco. LOGPOSE_OFFICIAL=1 mantém o official build (LTO), ao custo de recompilar tudo.
logpose_dev_args() {
    SCCACHE_ENABLED=y write_gn_args >/dev/null
    if [ "${LOGPOSE_OFFICIAL:-0}" != 1 ]; then
        sed -i 's/^is_official_build=.*/is_official_build=false/' "${_out_dir}/args.gn"
    fi
    sed -i -e 's/^symbol_level=.*/symbol_level=0/' \
        -e 's/^blink_symbol_level=.*/blink_symbol_level=0/' \
        "${_out_dir}/args.gn"
    echo 'v8_symbol_level=0' >> "${_out_dir}/args.gn"
    cat "${_out_dir}/args.gn"
}

logpose_version_header() {
    local version header="${_src_dir}/chrome/browser/logpose/logpose_version.h"
    version="$(cat "$_root_dir/logpose/VERSION")"
    grep -q "kLogPoseVersion\[\] = \"$version\"" "$header" ||
        sed -i "s/kLogPoseVersion\[\] = \"[^\"]*\"/kLogPoseVersion[] = \"$version\"/" "$header"
}

# guarda os patches aplicados pra saber depois quais mudaram
logpose_snapshot_patches() {
    rm -rf "$_applied"
    mkdir -p "$_applied"
    cp -a "$_root_dir/patches/." "$_applied/"
}

logpose_dev_setup() {
    if [ -d "${_src_dir}/out" ]; then
        echo "${_src_dir} já está pronto; pra recomeçar: logpose-build reset" >&2
        return 1
    fi

    rm -rf "$_src_dir" && mkdir -p "$_dl_cache" "$_src_dir"
    fetch_sources false false
    python3 "$_main_repo/utils/prune_binaries.py" --keep-build-dependencies "$_src_dir" "$_main_repo/pruning.list"
    helium_resources

    ___helium_patches_op merge
    (cd "$_src_dir" && quilt push -a)
    logpose_snapshot_patches
    ___helium_patches_op unmerge

    helium_version
    helium_apply_translations
    rm -f "$_brand_backup"
    logpose_branding

    logpose_dev_args
    gn_gen

    if [ "${LOGPOSE_KEEP_DOWNLOADS:-0}" != 1 ]; then
        rm -rf "$_dl_cache"
    fi
}

# Reaplica só os patches que mudaram desde a última aplicação (e os que vêm depois deles na série),
# pra não encostar no resto da árvore e não forçar rebuild do que não mudou.
logpose_dev_patches() {
    ___helium_patches_op merge
    cd "$_src_dir"

    local -a series=() applied=()
    mapfile -t series < <(grep -v '^\s*#' "$QUILT_SERIES" | sed -e 's/ #.*//' -e '/^\s*$/d')
    # o `quilt applied` mostra o caminho absoluto; o .pc guarda o nome como está na série
    mapfile -t applied < <(cat .pc/applied-patches 2>/dev/null || true)

    local i first=-1
    for i in "${!applied[@]}"; do
        if [ "${series[$i]:-}" != "${applied[$i]}" ] ||
            ! cmp -s "$QUILT_PATCHES/${applied[$i]}" "$_applied/${applied[$i]}"; then
            first=$i
            break
        fi
    done

    if [ "$first" -lt 0 ] && [ "${#series[@]}" -eq "${#applied[@]}" ]; then
        echo "patches sem mudança"
        cd "$_root_dir" && ___helium_patches_op unmerge
        return 0
    fi

    # a marca troca textos em .grd/.grdp/.xtb; se algum patch a reaplicar mexe neles, desfaz a marca antes
    local rebrand=false patch
    if [ "$first" -ge 0 ]; then
        for patch in "${applied[@]:$first}"; do
            if grep -qE '^\+\+\+ .*\.(grd|grdp|xtb)' "$_applied/$patch" "$QUILT_PATCHES/$patch" 2>/dev/null; then
                rebrand=true
            fi
        done
    fi
    if [ "$rebrand" = true ] && [ -f "$_brand_backup" ]; then
        python3 "$_root_dir/logpose/tools/logpose_name_substitution.py" --unsub -t "$_src_dir" --backup-path "$_brand_backup"
        rm -f "$_brand_backup"
    fi

    if [ "$first" -eq 0 ]; then
        QUILT_PATCHES="$_applied" quilt pop -a
    elif [ "$first" -gt 0 ]; then
        echo "reaplicando a partir de ${applied[$first]}"
        QUILT_PATCHES="$_applied" quilt pop "${applied[$((first - 1))]}"
    fi
    quilt push -a

    cd "$_root_dir"
    logpose_snapshot_patches
    ___helium_patches_op unmerge

    if [ "$rebrand" = true ]; then
        logpose_branding
    else
        logpose_version_header
    fi
}

logpose_dev_build() {
    cd "$_src_dir"
    configure_remoteexec
    SISO_PATH="${SISO_PATH:-third_party/siso/cipd/siso}" \
        nice -n 10 python3 third_party/depot_tools/autoninja.py -C "$_out_dir" chrome "$@"
}
