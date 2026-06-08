function BlockedDateBanner({ reason, dateLabel }) {
  return (
    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">This date is blocked.</p>
      {dateLabel ? <p className="mt-1">{dateLabel}</p> : null}
      {reason ? <p className="mt-1 opacity-95">Reason: {reason}</p> : null}
    </div>
  );
}

export default BlockedDateBanner;

