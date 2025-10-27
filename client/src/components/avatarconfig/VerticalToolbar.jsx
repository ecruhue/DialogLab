import { Plus, Image, Save, Trash,} from 'lucide-react';

const VerticalToolbar = ({ 
  onAddBox, 
  onUploadBackground, 
  onRemoveBackground, 
  onSave, 
  hasBackground,
  // setShowPartyManagerModal
}) => {
  // Improved button styling with better feedback states
  const buttonBaseClasses = "w-8 h-8 theme-text-inverse rounded-md transition-all duration-200 flex items-center justify-center shadow-sm hover:shadow-md focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-neutral-900 focus:ring-white/30";
  
  // Define button variants for different actions
  const buttonVariants = {
    add: "bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 active:from-blue-700 active:to-blue-800",
    background: "bg-gradient-to-br from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 active:from-emerald-700 active:to-emerald-800",
    delete: "bg-gradient-to-br from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:from-rose-700 active:to-rose-800",
            save: "bg-gradient-to-br from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 active:from-sky-700 active:to-sky-800",
            saveAs: "bg-gradient-to-br from-sky-600 to-sky-700 hover:from-sky-500 hover:to-sky-600 active:from-sky-700 active:to-sky-800",
    load: "bg-gradient-to-br from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 active:from-amber-700 active:to-amber-800",
  };
  
  // Tooltip component for consistent styling
  const Tooltip = ({ text }) => (
    <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 theme-bg-tooltip backdrop-blur-sm theme-text-inverse text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap pointer-events-none shadow-md z-50">
      {text}
    </div>
  );

  // Button component for consistent rendering
  const ToolbarButton = ({ onClick, variant, icon, tooltip, ariaLabel, ...props }) => (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`${buttonBaseClasses} ${buttonVariants[variant]} transform hover:scale-105 active:scale-95`}
        aria-label={ariaLabel || tooltip}
        {...props}
      >
        {icon}
      </button>
      <Tooltip text={tooltip} />
    </div>
  );
  
  // File Input Button (special case)
  const FileInputButton = ({ onChange, variant, icon, tooltip, accept }) => (
    <div className="relative group">
      <label className={`${buttonBaseClasses} ${buttonVariants[variant]} transform hover:scale-105 active:scale-95 cursor-pointer`}>
        {icon}
        <input
          type="file"
          accept={accept}
          className="hidden"
          onChange={onChange}
          aria-label={tooltip}
        />
      </label>
      <Tooltip text={tooltip} />
    </div>
  );
  
  return (
    <div className="flex flex-col gap-2 theme-bg-secondary p-2 rounded-lg mr-2 shadow-lg backdrop-blur-sm border theme-border-secondary">
      {/* Section divider */}
      <div className="flex flex-col gap-2">
        {/* Add Box */}
        <ToolbarButton 
          onClick={onAddBox}
          variant="add"
          icon={<Plus className="w-4 h-4" />}
          tooltip="Add Box"
        />

        {/* Background controls */}
        <FileInputButton
          onChange={onUploadBackground}
          variant="background"
          icon={<Image className="w-4 h-4" />}
          tooltip="Add Background"
          accept="image/*"
        />

        {/* Remove Background - Only shown when background exists */}
        {hasBackground && (
          <ToolbarButton 
            onClick={onRemoveBackground}
            variant="delete"
            icon={<Trash className="w-4 h-4" />}
            tooltip="Remove Background"
          />
        )}
      </div>

      {/* Divider */}
      <div className="h-px w-full theme-border-primary my-0.5"></div>

      {/* File Operations */}
      <div className="flex flex-col gap-2">
        {/* Save */}
        <ToolbarButton 
          onClick={onSave}
          variant="save"
          icon={<Save className="w-4 h-4" />}
          tooltip="Save Scene"
        />

      </div>
    </div>
  );
};

export default VerticalToolbar;