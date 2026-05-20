import { useState, useRef, useEffect } from "react";
import "./CustomDropdown.css";

export interface CustomDropdownOption {
  value: string;
  label: string;
  subtitle?: string;
  badge?: string;
  amount?: string;
  isSpecial?: boolean;
}

interface CustomDropdownProps {
  id?: string;
  label: string;
  value: string;
  options: CustomDropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CustomDropdown({
  label,
  value,
  options,
  onChange,
  placeholder = "Select an option..."
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.value === value);

  const toggleDropdown = () => setIsOpen(!isOpen);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const renderOptionContent = (opt: CustomDropdownOption) => {
    if (opt.isSpecial) {
      return (
        <div className="custom-dropdown-special">
          <span className="custom-dropdown-special-label">{opt.label}</span>
        </div>
      );
    }

    return (
      <div className="custom-dropdown-item-grid">
        <div className="custom-dropdown-item-left">
          <div className="custom-dropdown-item-header">
            {opt.badge && (
              <span className="custom-dropdown-item-badge">{opt.badge}</span>
            )}
            <span className="custom-dropdown-item-label">{opt.label}</span>
          </div>
          {opt.subtitle && (
            <span className="custom-dropdown-item-subtitle font-mono">{opt.subtitle}</span>
          )}
        </div>
        {opt.amount && (
          <div className="custom-dropdown-item-right">
            <span className="custom-dropdown-item-amount">{opt.amount}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="custom-dropdown-container" ref={containerRef}>
      <label className="form-label">{label}</label>
      <div 
        className={`custom-dropdown-trigger ${isOpen ? "open" : ""}`}
        onClick={toggleDropdown}
      >
        <div className="custom-dropdown-trigger-content">
          {selectedOption ? (
            selectedOption.isSpecial ? (
              <span className="selected-special">{selectedOption.label}</span>
            ) : (
              <div className="selected-info">
                {selectedOption.badge && (
                  <span className="selected-badge">{selectedOption.badge}</span>
                )}
                <span className="selected-text">
                  {selectedOption.label}
                </span>
                {selectedOption.amount && (
                  <span className="selected-amount ml-auto">
                    {selectedOption.amount}
                  </span>
                )}
              </div>
            )
          ) : (
            <span className="custom-dropdown-placeholder">{placeholder}</span>
          )}
        </div>
        <svg 
          className={`custom-dropdown-arrow ${isOpen ? "rotated" : ""}`} 
          width="14" 
          height="14" 
          viewBox="0 0 12 12" 
          fill="none"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {isOpen && (
        <div className="custom-dropdown-menu animate-fade-in">
          {options.length === 0 ? (
            <div className="custom-dropdown-empty">No options available</div>
          ) : (
            <div className="custom-dropdown-list">
              {options.map((opt) => (
                <div
                  key={opt.value}
                  className={`custom-dropdown-option-item ${opt.value === value ? "selected" : ""}`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {renderOptionContent(opt)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
