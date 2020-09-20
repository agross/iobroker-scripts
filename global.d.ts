type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
type ObjectDefinition = iobJS.Object & {
  // Those properties are removed before passing the object to ioBroker.
  nested?: ObjectDefinitionRoot;
  script?: any;
};

declare class ObjectCreator {
  public static create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void>;
}
