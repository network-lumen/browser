export type ParamSection = {
  id: string;
  title: string;
  path: string;
  open: boolean;
  loading: boolean;
  error: string;
  data: any;
  extract?: (json: any) => any;
};
