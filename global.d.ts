type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
type ObjectDefinition = iobJS.Object & {
  nested?: ObjectDefinitionRoot;
};

declare class ObjectCreator {
  public static create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void>;
}
