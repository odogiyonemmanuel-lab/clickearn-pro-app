/* eslint-disable */
export type DataModel = any;
export type TableNames = string;
export type Id<T extends string> = string & { __tableName: T };
