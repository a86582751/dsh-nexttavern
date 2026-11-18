/** The host catalog already reads the native version-zero one-shot row. */
import type {Session,SessionHeader} from 'dsh-nexttavern-native-session'

export function establishCatalogChild(parent:Session,child:SessionHeader,
  descriptor:{readonly mode:'one-shot';readonly label?:string}) {
  parent.append('subagent/catalog',{version:0,childId:child.id,childCreatedAt:child.createdAt,
    mode:'one-shot',...(descriptor.label===undefined?{}:{label:descriptor.label})})
}
