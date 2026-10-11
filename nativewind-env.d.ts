/// <reference types="nativewind/types" />

declare module "*.css";
declare module "*.sql" {
  const content: string;
  export default content;
}