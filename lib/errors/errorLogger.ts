export interface ErrorContext {
  route?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export interface LoggedError {
  id: string;
  timestamp: string;
}

function generateErrorId(): string {
  const rand=Math.random().toString(36).slice(2,8).toUpperCase();
  const d=new Date();
  const stamp=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  return `GL-${stamp}-${rand}`;
}

export function logError(error: unknown, context: ErrorContext = {}): LoggedError {
  const logged={id:generateErrorId(), timestamp:new Date().toISOString()};
  if(process.env.NODE_ENV!=="production"){
    console.error("[GorillaLedger]",{...logged,context,error});
  }
  return logged;
}
