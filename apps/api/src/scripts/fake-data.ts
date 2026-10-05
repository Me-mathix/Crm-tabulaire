import type { FieldType } from '@crm/shared';

export type SeedKey = 'name' | 'company' | 'phone' | 'city' | 'lastContact' | 'score';

export interface SeedField {
  key: SeedKey;
  label: string;
  type: FieldType;
  width: number;
}

export const DEFAULT_FIELDS: readonly SeedField[] = [
  { key: 'name', label: 'Nom', type: 'text', width: 200 },
  { key: 'company', label: 'Entreprise', type: 'text', width: 210 },
  { key: 'phone', label: 'Téléphone', type: 'phone', width: 160 },
  { key: 'city', label: 'Ville', type: 'text', width: 160 },
  { key: 'lastContact', label: 'Dernier contact', type: 'date', width: 150 },
  { key: 'score', label: 'Score', type: 'number', width: 110 },
];

/** Valeurs brutes, telles qu'un utilisateur les saisirait (normalisées ensuite par parseValue). */
export type FakeContact = Partial<Record<SeedKey, string | number>>;

const FIRST_NAMES = [
  'Élodie', 'Jérôme', 'Chloé', 'Anaïs', 'Hélène', 'Noé', 'Léa', 'Hugo', 'Manon', 'Lucas',
  'Camille', 'Louis', 'Inès', 'Gabriel', 'Zoé', 'Arthur', 'Margaux', 'Théo', 'Sarah', 'Nathan',
  'Clémence', 'Maxime', 'Juliette', 'Antoine', 'Pauline', 'Raphaël', 'Lucie', 'Mathis', 'Agathe',
  'Étienne', 'Océane', 'Benoît', 'Maëlle', 'Rémi', 'Amélie', 'Yanis', 'Céline', 'Karim', 'Aïcha', 'Thomas',
];

const LAST_NAMES = [
  'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
  'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
  'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand',
  'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guérin', 'Muller', 'Henry', 'Perrin', 'Morin', 'Mathieu',
  'Clément', 'Gauthier', 'Dumont', 'Lopez', 'Fontaine', 'Chevalier', 'Robin', 'Benali', 'Nguyen', 'Da Silva',
];

const COMPANY_PREFIXES = ['Atelier', 'Groupe', 'Studio', 'Maison', 'Cabinet', 'Agence', 'Société', 'Laboratoire'];
const COMPANY_NAMES = [
  'Lumière', 'Horizon', 'Boréal', 'Azur', 'Granit', 'Vertige', 'Cèdre', 'Opale', 'Kairos', 'Nova',
  'Hélios', 'Sillage', 'Ondine', 'Quartz', 'Mistral', 'Archipel',
];
const COMPANY_FORMS = ['SAS', 'SARL', 'SA', '', ''];

const CITIES = [
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux',
  'Lille', 'Rennes', 'Reims', 'Le Havre', 'Saint-Étienne', 'Toulon', 'Grenoble', 'Dijon', 'Angers',
  'Nîmes', 'Villeurbanne', 'Clermont-Ferrand', 'Aix-en-Provence', 'Brest', 'Tours', 'Amiens', 'Limoges',
  'Annecy', 'Perpignan', 'Metz', 'Besançon', 'Orléans', 'Rouen', 'Caen', 'Nancy', 'Nanterre', 'Avignon',
];

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, mêmes données. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateContacts(count: number, seed = 20261005, today = new Date()): FakeContact[] {
  const random = createRandom(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  const chance = (probability: number) => random() < probability;
  const digits = (length: number) =>
    Array.from({ length }, () => Math.floor(random() * 10)).join('');

  const phone = () => {
    const national = chance(0.85) ? `6${digits(8)}` : `14${digits(7)}`;
    return `0${national}`.replace(/(\d{2})(?=\d)/g, '$1 ');
  };

  const pastDate = () => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    date.setUTCDate(date.getUTCDate() - Math.floor(random() * 730));
    return date.toISOString().slice(0, 10);
  };

  const company = () => [pick(COMPANY_PREFIXES), pick(COMPANY_NAMES), pick(COMPANY_FORMS)].filter(Boolean).join(' ');

  return Array.from({ length: count }, () => {
    const contact: FakeContact = { name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` };
    // Quelques cellules vides, pour tester l'affichage, le tri et les filtres « est vide »
    if (!chance(0.07)) contact.company = company();
    if (!chance(0.08)) contact.phone = phone();
    if (!chance(0.05)) contact.city = pick(CITIES);
    if (!chance(0.1)) contact.lastContact = pastDate();
    if (!chance(0.05)) contact.score = Math.floor(random() * 101);
    return contact;
  });
}
