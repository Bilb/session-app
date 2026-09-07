const CPP_KEYWORDS = new Set([
  'alignas',
  'alignof',
  'and',
  'asm',
  'auto',
  'bool',
  'break',
  'case',
  'catch',
  'char',
  'class',
  'concept',
  'const',
  'consteval',
  'constexpr',
  'constinit',
  'continue',
  'decltype',
  'default',
  'delete',
  'do',
  'double',
  'else',
  'enum',
  'explicit',
  'export',
  'extern',
  'false',
  'float',
  'for',
  'friend',
  'goto',
  'if',
  'inline',
  'int',
  'long',
  'mutable',
  'namespace',
  'new',
  'noexcept',
  'not',
  'nullptr',
  'operator',
  'or',
  'private',
  'protected',
  'public',
  'register',
  'requires',
  'return',
  'short',
  'signed',
  'sizeof',
  'static',
  'struct',
  'switch',
  'template',
  'this',
  'throw',
  'true',
  'try',
  'typedef',
  'typeid',
  'typename',
  'union',
  'unsigned',
  'using',
  'virtual',
  'void',
  'volatile',
  'while',
  'xor',
])

/** `conversation-added` and `getAccountInfo` both become `ConversationAdded` / `GetAccountInfo`. */
export function pascal(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** `displayName` becomes `display_name`; `image-attachments` becomes `image_attachments`. */
export function snake(name: string): string {
  const s = name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()
  return CPP_KEYWORDS.has(s) ? `${s}_` : s
}
