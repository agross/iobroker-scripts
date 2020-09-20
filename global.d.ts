type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
type ObjectDefinition = iobJS.Object & {
  // Those properties are removed before passing the object to ioBroker.
  nested?: ObjectDefinitionRoot;
  script?: any;
  enumIds?: string[];
};

declare namespace iobJS {
  // Stuff ioBroker supports but for reasons beyond me is not declared.
  type AliasCommon = {
    alias?:
      | string
      | {
          read?: string;
          write?: string;
          id: string | { read?: string; write?: string };
        };
  };

  type CustomCommon = {
    custom?: {};
  };
}

declare class ObjectCreator {
  public static create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void>;

  public static getEnumIds(id: string, ...kinds: string[]): string[];
}
