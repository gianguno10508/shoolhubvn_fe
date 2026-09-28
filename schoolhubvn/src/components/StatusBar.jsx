import { STATUS_STAGES } from "../constants/appConstants";

export function StatusBar({ stage, onChangeStage, shareUrl }) {
  return (
    <div className="statusbar">
      <div className="share-row">
        <span className="share-label">Link chia sẻ:</span>
        <span className="share-url">{shareUrl}</span>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (navigator.clipboard) navigator.clipboard.writeText(shareUrl);
          }}
        >
          Copy Url
        </button>
      </div>
      <div className="stage-row">
        <span className="stage-label">Trạng thái Thời khóa biểu:</span>
        <div className="stage-track">
          {STATUS_STAGES.map((s) => (
            <button
              key={s}
              className={"stage" + (stage === s ? " active" : "")}
              onClick={() => onChangeStage(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StatusBar;
