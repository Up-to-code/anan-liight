export function ErrorBanner(props: { message: string }) {
  const parts = props.message.split("|").map((item) => item.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return <div className="error-banner">{props.message}</div>;
  }
  return (
    <div className="error-banner">
      <strong>{parts[0]}</strong>
      <details>
        <summary>Show details</summary>
        <p>{parts.slice(1).join(" | ")}</p>
      </details>
    </div>
  );
}
