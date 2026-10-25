// Variante en ligne de commande (facultative) : l'application propose le même import
// dans l'onglet Joueurs. Écrit import.sql et codes-joueurs.csv.
import fs from 'node:fs';
import { buildImport, fetchSupabase } from '../src/import.js';

const data = await fetchSupabase(
  process.env.SUPABASE_URL || 'https://fuaihkklnygbbiketvjb.supabase.co',
  process.env.SUPABASE_KEY || 'sb_publishable_gpkEUB2YbT1Q6jGO3AoUPQ_EpH6CpZQ');
const { sql, codes, stats } = await buildImport({ ...data, skip: (process.env.SKIP || '').split(',').filter(Boolean) });
fs.writeFileSync('import.sql', sql + '\n');
fs.writeFileSync('codes-joueurs.csv', 'nom;code\n' + codes.map((c) => `${c.name};${c.code}`).join('\n') + '\n');
console.log(JSON.stringify(stats), '-> import.sql, codes-joueurs.csv (ne pas publier)');
