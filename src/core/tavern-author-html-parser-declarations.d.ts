/** Compiler-only declarations for the actual narrow css-tree 3.2.1 exports. */
declare namespace NextTavernCssParserV1 {
  interface Position {offset:number;line:number;column:number}
  interface Location {start:Position;end:Position;source:string}
  interface Node {type:string;loc:Location|null;name?:string;value?:string}
  interface ParseOptions {
    context:'stylesheet'|'declarationList'
    positions:true
    parseCustomProperty:true
    onParseError:(error:Error)=>void
  }
  interface WalkContext {atrule:Node|null}
}
declare module 'css-tree/parser' {
  function parse(source:string,options:NextTavernCssParserV1.ParseOptions):NextTavernCssParserV1.Node
  export default parse
}
declare module 'css-tree/walker' {
  function walk(node:NextTavernCssParserV1.Node,
    visit:(this:NextTavernCssParserV1.WalkContext,node:NextTavernCssParserV1.Node)=>void):void
  export default walk
}
