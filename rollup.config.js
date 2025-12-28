import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/index.js',
  plugins: [ resolve(), commonjs()],
  external: [], // list external packages here (keep peer deps external)
  output: [
    {
      file: 'dist/esm/index.js',
      format: 'esm',
      sourcemap: true
    },
    {
      file: 'dist/cjs/index.cjs',
      format: 'cjs',
      sourcemap: true
    }
  ]
};
