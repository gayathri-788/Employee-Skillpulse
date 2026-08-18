export function StarRating({ rating }: { rating?: number | null }) {
  const value = rating || 0;
  const full = Math.floor(value);
  const half = value % 1 >= 0.5;
  return (
    <div className="inline-flex gap-0.5 text-warning">
      {Array.from({ length: 5 }, (_, i) => {
        const n = i + 1;
        if (n <= full) return <span key={n} className="material-icons-round text-[1.1rem]">star</span>;
        if (n === full + 1 && half) return <span key={n} className="material-icons-round text-[1.1rem]">star_half</span>;
        return (
          <span key={n} className="material-icons-round text-[1.1rem] text-bg-tertiary">
            star_outline
          </span>
        );
      })}
    </div>
  );
}
