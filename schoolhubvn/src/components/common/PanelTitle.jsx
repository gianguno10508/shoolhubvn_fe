export function PanelTitle({ title, actions }) {
  return (
    <div className="panel-title">
      <h2>{title}</h2>
      <button className="btn btn-info btn-sm guide">Hướng dẫn</button>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export default PanelTitle;
