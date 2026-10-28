export const ICON_CHOICES = [
  "house", "briefcase", "user", "users", "code", "terminal", "book-open", "graduation-cap",
  "music", "headphones", "film", "camera", "gamepad-2", "palette", "pen-tool", "heart",
  "star", "sparkles", "flame", "leaf", "coffee", "utensils", "shopping-cart", "shopping-bag",
  "landmark", "wallet", "piggy-bank", "chart-line", "plane", "car", "bike", "map-pin",
  "globe", "cloud", "sun", "moon", "zap", "rocket", "flask-conical", "brain",
  "dumbbell", "baby", "dog", "cat", "gift", "mail", "message-circle", "fingerprint",
  "shield", "lock", "key", "wrench", "server", "cpu", "newspaper", "trophy",
];

export function iconChoices(current) {
  return current && !ICON_CHOICES.includes(current) ? [current, ...ICON_CHOICES] : ICON_CHOICES;
}
