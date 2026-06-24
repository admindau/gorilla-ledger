import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldWrapperProps = {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

function FieldWrapper({ label, hint, error, children }: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label ? <label className="gl-label">{label}</label> : null}
      {children}
      {hint ? <p className="gl-field-hint">{hint}</p> : null}
      {error ? <p className="gl-field-error">{error}</p> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({ label, hint, error, className = "", ...props }: InputProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <input className={["gl-input", className].filter(Boolean).join(" ")} {...props} />
    </FieldWrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Select({ label, hint, error, className = "", children, ...props }: SelectProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <select className={["gl-input", className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Textarea({ label, hint, error, className = "", ...props }: TextareaProps) {
  return (
    <FieldWrapper label={label} hint={hint} error={error}>
      <textarea className={["gl-input min-h-24", className].filter(Boolean).join(" ")} {...props} />
    </FieldWrapper>
  );
}
