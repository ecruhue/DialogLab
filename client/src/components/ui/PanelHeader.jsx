const PanelHeader = ({ title, isEditing, onToggleEdit, rightContent, showEditIcon = true }) => {
  return (
    <div className="preview-header theme-bg-tertiary theme-text-primary">
      {title}
      <div className="flex items-center">
        {rightContent}
      </div>
    </div>
  );
};

export default PanelHeader; 