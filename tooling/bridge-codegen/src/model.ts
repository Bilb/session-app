import ts from 'typescript'

import { pascal, snake } from '#src/names'

/**
 * The subset of TypeScript the bridge protocol is allowed to use, as a model the emitters can
 * walk. Anything outside it is a hard error naming the offending declaration, because a type the
 * generator quietly skipped would be a type the C++ never fills.
 */

export type TypeRef =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  /** Binary, written as `Uint8Array`. */
  | { kind: 'bytes' }
  /**
   * Binary that is wiped when it goes, written as `SecretBytes`.
   *
   * The protocol declares `export type SecretBytes = Uint8Array` alongside the first field that
   * needs one -- there is nothing to declare until then, and an unused alias is just a thing to
   * wonder about. The generator matches the spelling rather than a declaration of ours.
   *
   * A separate kind rather than a flag on `bytes`, because the two want different C++: ordinary
   * bytes are a `std::vector`, and a secret is a buffer that zeroes in its destructor. Telling
   * them apart in the protocol is what lets a seed be handled as a seed everywhere it lands,
   * rather than everywhere somebody remembered.
   */
  | { kind: 'secret' }
  | { kind: 'enum'; name: string }
  | { kind: 'struct'; name: string }
  | { kind: 'union'; name: string }
  | { kind: 'array'; element: TypeRef }

export interface Field {
  /** The JavaScript property name; the emitters derive the C++ spelling. */
  name: string
  type: TypeRef
  optional: boolean
  doc: string[]
}

export interface Struct {
  name: string
  fields: Field[]
  /** Set on a union member: the literal the `type` property carries. */
  tag?: string
  doc: string[]
}

interface Enum {
  name: string
  members: string[]
  doc: string[]
}

interface Union {
  name: string
  /** Member struct names, in declaration order. */
  members: string[]
  doc: string[]
}

export type Declaration =
  | { kind: 'enum'; enum: Enum }
  | { kind: 'struct'; struct: Struct }
  | { kind: 'union'; union: Union }

export interface Model {
  /** Every declaration, dependencies before dependents, so C++ can be emitted in this order. */
  declarations: Declaration[]
}

class Extractor {
  private readonly program: ts.Program
  private readonly checker: ts.TypeChecker
  private readonly enums = new Map<string, Enum>()
  private readonly structs = new Map<string, Struct>()
  private readonly unions = new Map<string, Union>()
  private readonly declarations: Declaration[] = []
  /** Names currently being resolved, so a cycle is reported rather than looped on. */
  private readonly inProgress = new Set<string>()
  /**
   * Union aliases currently being flattened. Separate from `inProgress` because flattening runs
   * before the alias is entered - the members are what decide whether it is an enum or a variant
   * - so a pair of unions naming each other would recurse until the stack ran out.
   */
  private readonly flattening = new Set<string>()
  /**
   * Which declaration each generated name belongs to. A union member is named
   * `<Tag><Union>`, which an interface is free to be called as well, and whichever of the two
   * is resolved second would otherwise silently reuse the first one's struct.
   */
  private readonly owners = new Map<string, ts.Node>()

  constructor(program: ts.Program) {
    this.program = program
    this.checker = program.getTypeChecker()
  }

  extract(entryFile: string, roots: string[]): Model {
    const source = this.program.getSourceFile(entryFile)
    if (!source) throw new Error(`entry file not found: ${entryFile}`)
    const moduleSymbol = this.checker.getSymbolAtLocation(source)
    if (!moduleSymbol) throw new Error(`${entryFile} is not a module`)
    const exports = this.checker.getExportsOfModule(moduleSymbol)
    for (const root of roots) {
      const symbol = exports.find((s) => s.name === root)
      if (!symbol) throw new Error(`${entryFile} does not export ${root}`)
      this.resolveSymbol(symbol, root)
    }
    return { declarations: this.declarations }
  }

  private resolveSymbol(symbol: ts.Symbol, context: string): TypeRef {
    const target =
      symbol.flags & ts.SymbolFlags.Alias ? this.checker.getAliasedSymbol(symbol) : symbol
    const declaration = target.declarations?.[0]
    if (!declaration) throw new Error(`${context}: ${symbol.name} has no declaration`)
    if (ts.isInterfaceDeclaration(declaration)) return this.resolveInterface(declaration)
    if (ts.isTypeAliasDeclaration(declaration)) return this.resolveAlias(declaration)
    throw fail(declaration, `${context}: ${symbol.name} is neither an interface nor a type alias`)
  }

  private resolveInterface(node: ts.InterfaceDeclaration): TypeRef {
    const name = node.name.text
    this.claim(name, node)
    // Set only once the struct is complete, so a type reached twice is emitted once while a
    // type that reaches itself falls through to the cycle check below.
    if (this.structs.has(name)) return { kind: 'struct', name }
    if (node.heritageClauses?.length) throw fail(node, `${name}: interfaces may not extend`)
    if (node.typeParameters?.length) throw fail(node, `${name}: generics are not supported`)
    this.enter(name, node)
    const struct: Struct = { name, fields: this.fieldsOf(node.members, name), doc: jsDoc(node) }
    this.structs.set(name, struct)
    this.declarations.push({ kind: 'struct', struct })
    this.inProgress.delete(name)
    return { kind: 'struct', name }
  }

  private resolveAlias(node: ts.TypeAliasDeclaration): TypeRef {
    const name = node.name.text
    // Before the memo checks: two aliases spelling one name would otherwise collapse silently.
    this.claim(name, node)
    if (this.enums.has(name)) return { kind: 'enum', name }
    if (this.unions.has(name)) return { kind: 'union', name }
    if (node.typeParameters?.length) throw fail(node, `${name}: generics are not supported`)

    if (!ts.isUnionTypeNode(node.type)) {
      // A transparent alias such as `type ConversationId = string`. Tracked like the others, or
      // a pair that aliases each other recurses until the stack runs out instead of reporting.
      this.enter(name, node)
      try {
        return this.resolveTypeNode(node.type, name)
      } finally {
        this.inProgress.delete(name)
      }
    }

    const members = this.flattenUnion(node.type, name)
    const literals = members.flatMap((m) =>
      ts.isLiteralTypeNode(m) && ts.isStringLiteral(m.literal) ? [m.literal.text] : [],
    )
    if (literals.length === members.length) {
      this.enter(name, node)
      const spellings = new Map<string, string>()
      for (const [i, literal] of literals.entries()) {
        const at = members[i] ?? node
        checkLiteral(literal, at, name)
        const spelling = snake(literal)
        if (!IDENTIFIER.test(spelling))
          throw fail(at, `${name}: '${literal}' does not spell a C++ enumerator`)
        const already = spellings.get(spelling)
        if (already !== undefined)
          throw fail(at, `${name}: '${literal}' and '${already}' both spell ${spelling}`)
        spellings.set(spelling, literal)
      }
      const enumeration: Enum = { name, members: literals, doc: jsDoc(node) }
      this.enums.set(name, enumeration)
      this.declarations.push({ kind: 'enum', enum: enumeration })
      this.inProgress.delete(name)
      return { kind: 'enum', name }
    }

    const literalMembers = members.flatMap((m) => (ts.isTypeLiteralNode(m) ? [m] : []))
    if (literalMembers.length === members.length) {
      this.enter(name, node)
      const structNames = literalMembers.map((m) => this.resolveUnionMember(m, name))
      const union: Union = { name, members: structNames, doc: jsDoc(node) }
      this.unions.set(name, union)
      this.declarations.push({ kind: 'union', union })
      this.inProgress.delete(name)
      return { kind: 'union', name }
    }

    throw fail(
      node,
      `${name}: a union must be all string literals (an enum) or all object literals tagged by a literal 'type' (a variant)`,
    )
  }

  /** `A | B` where `A` is itself a union alias contributes `A`'s members in place. */
  private flattenUnion(node: ts.UnionTypeNode, context: string): ts.TypeNode[] {
    const out: ts.TypeNode[] = []
    for (const member of node.types) {
      if (ts.isTypeReferenceNode(member)) {
        const symbol = this.checker.getSymbolAtLocation(member.typeName)
        const target =
          symbol && symbol.flags & ts.SymbolFlags.Alias
            ? this.checker.getAliasedSymbol(symbol)
            : symbol
        const declaration = target?.declarations?.[0]
        if (
          declaration &&
          ts.isTypeAliasDeclaration(declaration) &&
          ts.isUnionTypeNode(declaration.type)
        ) {
          const alias = declaration.name.text
          if (this.flattening.has(alias))
            throw fail(member, `${alias} is part of a cycle; C++ values cannot contain themselves`)
          this.flattening.add(alias)
          try {
            out.push(...this.flattenUnion(declaration.type, context))
          } finally {
            this.flattening.delete(alias)
          }
          continue
        }
        throw fail(member, `${context}: a union member must be an object literal, not a reference`)
      }
      out.push(member)
    }
    return out
  }

  private resolveUnionMember(node: ts.TypeLiteralNode, unionName: string): string {
    const tagMember = node.members.find(
      (m) => ts.isPropertySignature(m) && ts.isIdentifier(m.name) && m.name.text === 'type',
    )
    if (
      !tagMember ||
      !ts.isPropertySignature(tagMember) ||
      !tagMember.type ||
      !ts.isLiteralTypeNode(tagMember.type) ||
      !ts.isStringLiteral(tagMember.type.literal)
    ) {
      throw fail(node, `${unionName}: every member needs a string-literal 'type' property`)
    }
    if (tagMember.questionToken)
      throw fail(tagMember, `${unionName}: the 'type' tag cannot be optional`)
    const tag = tagMember.type.literal.text
    checkLiteral(tag, tagMember, unionName)
    if (!IDENTIFIER.test(`${pascal(tag)}${unionName}`))
      throw fail(tagMember, `${unionName}: the tag '${tag}' does not make a C++ identifier`)
    const name = `${pascal(tag)}${unionName}`
    // Always a fresh struct: two members of one union cannot share a tag, and no other
    // declaration may already own the name this one generates.
    this.claim(name, node)
    const others = node.members.filter((m) => m !== tagMember)
    const struct: Struct = { name, fields: this.fieldsOf(others, name), tag, doc: memberDoc(node) }
    this.structs.set(name, struct)
    this.declarations.push({ kind: 'struct', struct })
    return name
  }

  private fieldsOf(
    members: ts.NodeArray<ts.TypeElement> | ts.TypeElement[],
    owner: string,
  ): Field[] {
    const fields: Field[] = []
    // `sessionId` and `sessionID` both snake to `session_id`, which is a duplicate C++ member.
    const spellings = new Map<string, string>()
    for (const member of members) {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name) || !member.type) {
        throw fail(member, `${owner}: only plain named properties are supported`)
      }
      if (member.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword)) {
        throw fail(member, `${owner}.${member.name.text}: readonly has no C++ meaning here`)
      }
      const name = member.name.text
      const spelling = snake(name)
      const already = spellings.get(spelling)
      if (already !== undefined)
        throw fail(member, `${owner}: '${name}' and '${already}' both spell ${spelling}`)
      spellings.set(spelling, name)
      fields.push({
        name,
        type: this.resolveTypeNode(member.type, `${owner}.${name}`),
        optional: member.questionToken !== undefined,
        doc: jsDoc(member),
      })
    }
    return fields
  }

  private resolveTypeNode(node: ts.TypeNode, context: string): TypeRef {
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        return { kind: 'string' }
      case ts.SyntaxKind.NumberKeyword:
        return { kind: 'number' }
      case ts.SyntaxKind.BooleanKeyword:
        return { kind: 'boolean' }
      default:
        break
    }
    if (ts.isArrayTypeNode(node)) {
      return { kind: 'array', element: this.resolveTypeNode(node.elementType, `${context}[]`) }
    }
    if (ts.isTypeReferenceNode(node)) {
      if (node.typeArguments?.length)
        throw fail(node, `${context}: generic types are not supported`)
      // Matched by name, before the symbol is resolved: these two are not declarations of ours to
      // generate, they are the spellings the protocol uses for binary. `SecretBytes` is an alias
      // for `Uint8Array` on the TypeScript side, so a caller sees one type and the C++ sees two.
      const named = node.typeName.getText()
      if (named === 'Uint8Array') return { kind: 'bytes' }
      if (named === 'SecretBytes') return { kind: 'secret' }
      const symbol = this.checker.getSymbolAtLocation(node.typeName)
      if (!symbol) throw fail(node, `${context}: cannot resolve ${node.typeName.getText()}`)
      return this.resolveSymbol(symbol, context)
    }
    if (ts.isParenthesizedTypeNode(node)) return this.resolveTypeNode(node.type, context)
    throw fail(
      node,
      `${context}: unsupported type '${node.getText()}' (allowed: string, number, boolean, Uint8Array, SecretBytes, a string-union alias, an interface, a tagged union alias, or an array of one)`,
    )
  }

  /**
   * Records that `name` is this declaration's to generate, and rejects anything else claiming it.
   */
  private claim(name: string, node: ts.Node): void {
    const existing = this.owners.get(name)
    if (existing && existing !== node) {
      throw fail(node, `${name} is generated twice: this declaration and ${where(existing)}`)
    }
    this.owners.set(name, node)
  }

  private enter(name: string, node: ts.Node): void {
    if (this.inProgress.has(name)) {
      throw fail(node, `${name} is part of a cycle; C++ values cannot contain themselves`)
    }
    this.inProgress.add(name)
  }
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * A literal that reaches C++ twice: once inside a string literal, once as part of an identifier.
 * Neither survives a quote, a backslash or anything outside printable ASCII, and the generator
 * refuses rather than emitting a header that will not compile.
 */
function checkLiteral(text: string, node: ts.Node, context: string): void {
  if (text === '') throw fail(node, `${context}: an empty string literal has no C++ spelling`)
  if (!/^[\x20-\x7e]*$/.test(text) || /["\\]/.test(text))
    throw fail(node, `${context}: '${text}' cannot be written as a C++ string literal`)
}

function where(node: ts.Node): string {
  const source = node.getSourceFile()
  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart())
  return `${source.fileName}:${line + 1}:${character + 1}`
}

function fail(node: ts.Node, message: string): Error {
  return new Error(`${where(node)}: ${message}`)
}

/** The lines of the JSDoc block attached to a declaration, without the comment markers. */
function jsDoc(node: ts.Node): string[] {
  const docs = ts.getJSDocCommentsAndTags(node)
  const lines: string[] = []
  for (const doc of docs) {
    if (!ts.isJSDoc(doc)) continue
    const text =
      typeof doc.comment === 'string' ? doc.comment : ts.getTextOfJSDocComment(doc.comment)
    if (text) lines.push(...text.split('\n'))
  }
  return lines
}

/**
 * A union member's doc block sits in front of the `|` that introduces it, which the parser
 * attaches to nothing, so it is read from the source text between the previous member and this one.
 */
function memberDoc(node: ts.TypeLiteralNode): string[] {
  const source = node.getSourceFile().text
  const parent = node.parent
  if (!ts.isUnionTypeNode(parent)) return []
  const index = parent.types.indexOf(node)
  const from = index === 0 ? parent.pos : parent.types[index - 1]!.end
  const between = source.slice(from, node.getStart())
  const blocks = [...between.matchAll(/\/\*\*([\s\S]*?)\*\//g)]
  const last = blocks[blocks.length - 1]
  if (!last?.[1]) return []
  return last[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*?\s?/, '').trimEnd())
    .filter((line, i, all) => !(line === '' && (i === 0 || i === all.length - 1)))
}

export interface ExtractOptions {
  /** The module whose exports name the roots; usually packages/bridge-types/src/index.ts. */
  entryFile: string
  /** Exported type names to start from; everything reachable from them is generated. */
  roots: string[]
}

export function extractModel({ entryFile, roots }: ExtractOptions): Model {
  const program = ts.createProgram([entryFile], {
    strict: true,
    exactOptionalPropertyTypes: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    types: [],
  })
  const diagnostics = program.getSyntacticDiagnostics()
  if (diagnostics.length) {
    const first = diagnostics[0]!
    throw new Error(ts.flattenDiagnosticMessageText(first.messageText, '\n'))
  }
  return new Extractor(program).extract(entryFile, roots)
}
