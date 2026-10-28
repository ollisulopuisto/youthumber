import assert from 'node:assert/strict'
import { ESLint } from 'eslint'
const eslint = new ESLint()
const fixtures = [
  ['undefined JSX', 'export const X=()=> <Missing />', 'no-undef'],
  ['missing key', 'export const X=()=> [<div/>]', '@eslint-react/no-missing-key'],
  ['comment text', 'export const X=()=> <div>// comment</div>', '@eslint-react/jsx-no-comment-textnodes'],
  ['children prop', 'export const X=()=> <div children="bad"/>', '@eslint-react/jsx-no-children-prop'],
  ['danger with children', 'export const X=()=> <div dangerouslySetInnerHTML={{__html:""}}>bad</div>', '@eslint-react/dom-no-dangerously-set-innerhtml-with-children'],
  ['unknown DOM prop', 'export const X=()=> <div class="x"/>', '@eslint-react/dom-no-unknown-property'],
  ['hook order', 'import {useState} from "react"; export function X({ok}){if(ok)useState(0);return null}', 'react-hooks/rules-of-hooks'],
]
for (const [name, source, rule] of fixtures) {
  const [result] = await eslint.lintText(source, {filePath: 'src/lint-fixture.jsx'})
  assert(result.messages.some(message => message.ruleId === rule), `${name}: expected ${rule}`)
}
console.log(`${fixtures.length} ESLint migration fixtures passed`)
