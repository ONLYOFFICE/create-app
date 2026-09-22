import type { ReactNode } from 'react';

type Props = {
  title: string;
  errors?: string[];
  hint?: ReactNode;
};

export function ErrorBanner({ title, errors, hint }: Props) {
  return (
    <div className="banner banner-error" role="alert">
      <strong>{title}</strong>
      {errors && errors.length > 0 ? (
        <ul>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {hint ? <p style={{ margin: '8px 0 0' }}>{hint}</p> : null}
    </div>
  );
}
