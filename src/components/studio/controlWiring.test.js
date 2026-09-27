/* @vitest-environment jsdom */
// Static guard against decorative controls silently becoming inert. Behavioral
// tests are still required: having a handler alone does not prove functionality.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('requires every studio button to have an action or an explicit disabled state', () => {
  const folder = resolve('src/components/studio');
  const components = (dir) =>
    readdirSync(dir, { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.jsx') && !name.includes('.test.'))
      .map((name) => resolve(dir, name));
  const files = [...components(folder), ...components(resolve('src/studio'))];
  files.push(resolve('src/pages/SattariStudioPage.jsx'));
  const inert = [];
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JSX
    );
    const visit = (node) => {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ['button', 'StudioAction'].includes(node.tagName.getText(source))
      ) {
        // StudioAction forwards its handlers; check its call sites above and
        // exercise the forwarding contract in StudioAction.test.jsx.
        const forwardsActionProps =
          file === resolve(folder, 'StudioAction.jsx') &&
          node.tagName.getText(source) === 'button' &&
          node.attributes.properties.some(
            (attribute) =>
              ts.isJsxSpreadAttribute(attribute) &&
              ts.isIdentifier(attribute.expression) &&
              attribute.expression.text === 'props'
          );
        const names = node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((attribute) => attribute.name.getText(source));
        if (
          !forwardsActionProps &&
          !names.some((name) =>
            ['onClick', 'onPointerDown', 'onMouseDown', 'disabled'].includes(name)
          )
        ) {
          inert.push(`${file}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(inert).toEqual([]);
});
