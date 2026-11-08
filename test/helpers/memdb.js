'use strict';
// Banco em memória com o subconjunto da API do driver usado pelos coletores (só para testes).
const clone = (o) => JSON.parse(JSON.stringify(o));
const get = (o, k) => k.split('.').reduce((a, p) => (a == null ? undefined : a[p]), o);
function setPath(o, k, v) {
  const ps = k.split('.'); let c = o;
  for (const p of ps.slice(0, -1)) { if (c[p] == null || typeof c[p] !== 'object') { if (c[p] === null) throw new Error(`Cannot create field in null ${p}`); c[p] = {}; } c = c[p]; }
  c[ps[ps.length - 1]] = clone(v);
}
function unsetPath(o, k) { const ps = k.split('.'); const parent = ps.length > 1 ? get(o, ps.slice(0, -1).join('.')) : o; if (parent) delete parent[ps[ps.length - 1]]; }
const match = (d, f = {}) => Object.entries(f).every(([k, v]) => get(d, k) === v);

function memdb(seed = {}) {
  const data = {};
  for (const [k, v] of Object.entries(seed)) data[k] = clone(v);
  const col = (name) => {
    const docs = (data[name] = data[name] || []);
    return {
      find: (f) => ({ toArray: async () => clone(docs.filter((d) => match(d, f))) }),
      findOne: async (f) => { const d = docs.find((x) => match(x, f)); return d ? clone(d) : null; },
      insertOne: async (d) => { if (docs.some((x) => x._id === d._id)) throw new Error('duplicate _id ' + d._id); docs.push(clone(d)); },
      updateOne: async (f, u, o = {}) => {
        let d = docs.find((x) => match(x, f));
        if (!d) { if (!o.upsert) return { matchedCount: 0 }; d = clone(f); docs.push(d); for (const [k, v] of Object.entries(u.$setOnInsert || {})) setPath(d, k, v); }
        for (const [k, v] of Object.entries(u.$set || {})) setPath(d, k, v);
        for (const k of Object.keys(u.$unset || {})) unsetPath(d, k);
        return { matchedCount: 1 };
      },
    };
  };
  return { collection: col, data };
}
module.exports = { memdb };
