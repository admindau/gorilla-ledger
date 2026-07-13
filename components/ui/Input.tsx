"use client";

import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

type FieldWrapperProps = {
  id: string;
  label?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
};

function FieldWrapper({
  id,
  label,
  hint,
  hintId,
  error,
  errorId,
  children,
}: FieldWrapperProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <label className="gl-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? (
        <p id={hintId} className="gl-field-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="gl-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedByValue(
  existing: string | undefined,
  hintId: string | undefined,
  errorId: string | undefined,
) {
  return [existing, hintId, errorId].filter(Boolean).join(" ") || undefined;
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Input({
  id,
  label,
  hint,
  error,
  className = "",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const generatedId = useId();
  const fieldId = id ?? `gl-input-${generatedId.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <input
        id={fieldId}
        className={["gl-input", className].filter(Boolean).join(" ")}
        aria-describedby={describedByValue(ariaDescribedBy, hintId, errorId)}
        aria-invalid={ariaInvalid ?? (error ? true : undefined)}
        {...props}
      />
    </FieldWrapper>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export function Select({
  id,
  label,
  hint,
  error,
  className = "",
  children,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const fieldId = id ?? `gl-select-${generatedId.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <select
        id={fieldId}
        className={["gl-input", className].filter(Boolean).join(" ")}
        aria-describedby={describedByValue(ariaDescribedBy, hintId, errorId)}
        aria-invalid={ariaInvalid ?? (error ? true : undefined)}
        {...props}
      >
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

export function Textarea({
  id,
  label,
  hint,
  error,
  className = "",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const fieldId = id ?? `gl-textarea-${generatedId.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldWrapper
      id={fieldId}
      label={label}
      hint={hint}
      hintId={hintId}
      error={error}
      errorId={errorId}
    >
      <textarea
        id={fieldId}
        className={["gl-input min-h-24", className].filter(Boolean).join(" ")}
        aria-describedby={describedByValue(ariaDescribedBy, hintId, errorId)}
        aria-invalid={ariaInvalid ?? (error ? true : undefined)}
        {...props}
      />
    </FieldWrapper>
  );
}
