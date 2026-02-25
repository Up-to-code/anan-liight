import type { ReactNode } from "react";

export function ConfirmActionModal(props: {
  open: boolean;
  title: string;
  reason: string;
  confirmation: string;
  onReasonChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  children?: ReactNode;
}) {
  if (!props.open) return null;

  const disabled = props.reason.trim().length === 0 || props.confirmation !== "CONFIRM" || props.busy;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h4>{props.title}</h4>
        {props.children}
        <input value={props.reason} onChange={(event) => props.onReasonChange(event.target.value)} placeholder="Reason" />
        <input value={props.confirmation} onChange={(event) => props.onConfirmationChange(event.target.value)} placeholder="Type CONFIRM" />
        <div className="modal-actions">
          <button onClick={props.onCancel}>Cancel</button>
          <button disabled={disabled} onClick={props.onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
