'use client';

import { TopBar } from '@/components/TopBar';

const EXPORTS: { type: string; label: string; description: string }[] = [
  { type: 'arrives', label: 'Invités arrivés', description: 'Toutes les invitations avec au moins 1 personne arrivée' },
  { type: 'absents', label: 'Invités absents', description: 'Invitations avec 0 personne arrivée' },
  { type: 'partiels', label: 'Arrivées partielles', description: 'Invitations incomplètes, avec le nombre de manquants' },
  { type: 'supplementaires', label: 'Personnes supplémentaires', description: 'Excédents affectés aux tables de réserve' },
  { type: 'repartition', label: 'Répartition finale des tables', description: 'Occupation de chaque table, capacité et places restantes' },
  { type: 'reserve', label: 'Utilisation des tables de réserve', description: 'Détail des affectations sur les tables 37-40' },
];

export default function ExportsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Exports" backHref="/admin" />

      <div className="flex-1 space-y-3 px-4 py-4">
        {EXPORTS.map((exp) => (
          <div key={exp.type} className="card">
            <p className="font-semibold">{exp.label}</p>
            <p className="mb-3 text-sm text-black/50">{exp.description}</p>
            <div className="grid grid-cols-2 gap-2">
              <a href={`/api/export?type=${exp.type}&format=csv`} className="btn-secondary text-center">
                CSV
              </a>
              <a href={`/api/export?type=${exp.type}&format=xlsx`} className="btn-secondary text-center">
                XLSX
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
