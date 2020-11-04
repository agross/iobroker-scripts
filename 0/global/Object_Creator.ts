declare global {
  export type ObjectDefinitionRoot = { [id: string]: ObjectDefinition };
  export type ObjectDefinition = iobJS.Object & {
    // Those properties are removed before passing the object to ioBroker.
    nested?: ObjectDefinitionRoot;
    script?: any;
    enumIds?: string[];
  };

  export class ObjectCreator {
    static create(
      definition: ObjectDefinitionRoot,
      baseId: string,
    ): Promise<void>;

    static getEnumIds(objectId: string, ...kinds: string[]): string[];
  }

  namespace iobJS {
    export type AliasCommon = {
      alias?:
        | string
        | {
            read?: string;
            write?: string;
            id: string | { read?: string; write?: string };
          };
    };

    export type CustomCommon = {
      custom?: {};
    };
  }
}

// https://github.com/ioBroker/ioBroker.javascript/issues/694#issuecomment-721675742
export {};

type EnumIdsToObjects = { [id: string]: string[] };

export class ObjectCreator {
  public static async create(
    definition: ObjectDefinitionRoot,
    baseId: string,
  ): Promise<void> {
    const enums = {} as EnumIdsToObjects;

    await this.createObjects(definition, baseId, enums);
    await this.assignEnums(enums);
  }

  public static getEnumIds(objectId: string, ...kinds: string[]): string[] {
    return kinds
      .map(kind => (getObject(objectId, kind) as any).enumIds as string[])
      .reduce((acc, ids) => acc.concat(ids));
  }

  private static async createObjects(
    definition: ObjectDefinitionRoot,
    baseId: string,
    enums: EnumIdsToObjects,
  ): Promise<void> {
    const promises = Object.entries(definition).map(async ([id, def]) => {
      const objectId = this.contextualId(baseId, id);
      const data = this.definition(def);

      log(`Creating ${objectId} from ${JSON.stringify(data)}`, 'debug');
      await setObjectAsync(objectId, data);
      log(`Created ${objectId}`);

      this.assign(enums, objectId, def.enumIds);

      if (def.nested) {
        await this.createObjects(def.nested, objectId, enums);
      }
    });

    await Promise.all(promises);
  }

  private static assign(
    mapping: EnumIdsToObjects,
    objectId: string,
    enumIds: string[],
  ): void {
    if (!enumIds) {
      return;
    }

    enumIds.forEach(enumId => {
      if (!mapping.hasOwnProperty(enumId)) {
        mapping[enumId] = [];
      }

      mapping[enumId].push(objectId);
    });
  }

  private static async assignEnums(enums: EnumIdsToObjects): Promise<void> {
    for (let [enumId, objectIds] of Object.entries(enums)) {
      const _enum = await getObjectAsync(enumId);
      const common = (_enum.common as unknown) as { members: string[] };

      const members = Array.from(common.members);
      objectIds.forEach(objectId => {
        if (!members.includes(objectId)) {
          log(`Appending ${objectId} to ${enumId}`);
          members.push(objectId);
        }
      });

      if (members.length != common.members.length) {
        log(`Saving ${enumId}`);
        await extendObjectAsync(enumId, { common: { members: members } });
      }
    }
  }

  private static contextualId(base: string, id: string) {
    return `${base}.${id}`;
  }

  private static definition(definition: ObjectDefinition): iobJS.Object {
    const dup = Object.assign({} as ObjectDefinition, definition);
    delete dup.nested;
    delete dup.script;
    delete dup.enumIds;

    return dup;
  }
}
