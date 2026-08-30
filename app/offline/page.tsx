export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-3xl">📡</p>
      <p className="font-display text-xl font-bold">Hors ligne</p>
      <p className="text-text-muted">
        Aucune connexion internet détectée. Les entrées ne peuvent pas être validées sans connexion — reconnectez-vous
        puis réessayez.
      </p>
    </div>
  );
}
