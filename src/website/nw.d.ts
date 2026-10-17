import "react";

// NW.js attributes for <input type="file">, which @types/nw.js doesn't
// declare for React's JSX. See docs.nwjs.io on file dialogs.
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match React's declaration
  interface InputHTMLAttributes<T> {
    nwdirectory?: boolean;
    nwsaveas?: string;
    nwworkingdir?: string;
  }
}
