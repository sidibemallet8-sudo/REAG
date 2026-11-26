import { DocumentarySource, SourceKind, SourceReliability } from '../types/reag';
import { createId } from '../utils/deterministic';

export interface CreateSourceInput {
  title: string;
  kind: SourceKind;
  reliability: SourceReliability;
  reference: string;
  excerpt: string;
}

export const ResearchManager = {
  createSource(input: CreateSourceInput): DocumentarySource {
    if (!input.title.trim()) {
      throw new Error('Le titre de la source documentaire est requis.');
    }
    if (!input.excerpt.trim()) {
      throw new Error("L'extrait ou contenu documentaire ne peut pas être vide.");
    }
    return {
      id: createId('src'),
      title: input.title.trim(),
      kind: input.kind,
      reliability: input.reliability,
      reference: input.reference.trim() || 'reference-locale',
      excerpt: input.excerpt.trim(),
      createdAt: new Date().toISOString(),
    };
  },

  addSource(sources: DocumentarySource[], input: CreateSourceInput): DocumentarySource[] {
    const created = this.createSource(input);
    return [created, ...sources];
  },

  removeSource(sources: DocumentarySource[], sourceId: string): DocumentarySource[] {
    return sources.filter((s) => s.id !== sourceId);
  },

  parseImportedSourceFile(fileName: string, content: string): DocumentarySource[] {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error(`Le fichier "${fileName}" est vide.`);
    }

    if (fileName.toLowerCase().endsWith('.json')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw new Error(`Le fichier JSON "${fileName}" contient une erreur de syntaxe.`);
      }
      const list = Array.isArray(parsed) ? parsed : [parsed];
      return list.map((item, idx) => {
        const obj = item as Partial<DocumentarySource>;
        return this.createSource({
          title: obj.title || `${fileName} (#${idx + 1})`,
          kind: obj.kind || 'fichier_importe',
          reliability: obj.reliability || 'partielle',
          reference: obj.reference || `fichier://${fileName}`,
          excerpt: obj.excerpt || JSON.stringify(item),
        });
      });
    }

    // Fichier texte ou Markdown : découpage en sections par titres (#) ou bloc unique
    const sections = trimmed
      .split(/\n(?=# )/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (sections.length > 1) {
      return sections.map((section, idx) => {
        const lines = section.split('\n');
        const firstLine = lines[0].replace(/^#+\s*/, '').trim();
        const body = lines.slice(1).join('\n').trim() || firstLine;
        return this.createSource({
          title: firstLine || `${fileName} — Section ${idx + 1}`,
          kind: 'fichier_importe',
          reliability: 'partielle',
          reference: `fichier://${fileName}#section-${idx + 1}`,
          excerpt: body,
        });
      });
    }

    return [
      this.createSource({
        title: fileName.replace(/\.[^.]+$/, ''),
        kind: 'fichier_importe',
        reliability: 'partielle',
        reference: `fichier://${fileName}`,
        excerpt: trimmed,
      }),
    ];
  },
};
