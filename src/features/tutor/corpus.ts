import { bones, getBone } from '@/data/bones'
import { joints, resolveJointBones } from '@/data/joints'
import { REGION_LABEL } from '@/data/labels'
import { walks } from '@/data/walks'
import type { Bone, Joint, Landmark, Walk } from '@/types/anatomy'

export type AtlasDocKind = 'bone' | 'landmark' | 'joint' | 'walk'

/** One retrievable piece of atlas content. Left and right copies of a structure share one document. */
export interface AtlasDoc {
  /** Citation key, `kind:id`, using the left-side id for paired structures. */
  key: string
  kind: AtlasDocKind
  /** Ids the viewer can select for this document: both sides for paired structures. */
  ids: string[]
  title: string
  /** Alternate names and keywords, weighted above body text in search. */
  aliases: string[]
  text: string
}

function sideless(id: string): string {
  return id.replace(/_(left|right)(?=_|$)/, '')
}

function sideNote(bone: Bone): string {
  return bone.side === 'midline' ? 'a midline bone' : 'paired, left and right'
}

function boneDoc(bone: Bone, ids: string[]): AtlasDoc {
  const parts = [
    `${bone.name} (${sideNote(bone)}). Region: ${REGION_LABEL[bone.region]}. Classification: ${bone.classification} bone.`,
    bone.description,
  ]
  if (bone.compositeOf?.length) {
    const members = [...new Set(bone.compositeOf.map((id) => getBone(id)?.name).filter(Boolean))]
    parts.push(`Made up of: ${members.join(', ')}.`)
  }
  if (bone.partOf) parts.push(`Part of: ${getBone(bone.partOf)?.name ?? bone.partOf}.`)
  if (bone.articulations.length) parts.push(`Articulates with: ${bone.articulations.join(', ')}.`)
  if (bone.landmarks.length) parts.push(`Landmarks: ${bone.landmarks.map((landmark) => landmark.name).join(', ')}.`)
  const aliases = bone.alternateNames.filter((name) => !/^(left|right) /.test(name))
  return {
    key: `bone:${ids[0]}`,
    kind: 'bone',
    ids,
    title: bone.name,
    aliases: [...aliases, ...bone.keywords],
    text: parts.join(' '),
  }
}

function landmarkDoc(bone: Bone, landmark: Landmark, ids: string[]): AtlasDoc {
  const parts = [
    `${landmark.name}, a landmark on the ${bone.name.toLowerCase()} (${REGION_LABEL[bone.region]}).`,
    landmark.description,
  ]
  if (landmark.significance) parts.push(landmark.significance)
  return {
    key: `landmark:${ids[0]}`,
    kind: 'landmark',
    ids,
    title: `${landmark.name} (${bone.name})`,
    aliases: [],
    text: parts.join(' '),
  }
}

function jointDoc(joint: Joint): AtlasDoc {
  const boneNames = [
    ...new Set(
      resolveJointBones(joint)
        .map((id) => getBone(id)?.name)
        .filter(Boolean),
    ),
  ]
  const parts = [`${joint.name}. Region: ${REGION_LABEL[joint.region]}.`, joint.description]
  if (joint.movements.length) parts.push(`Movements: ${joint.movements.join(', ')}.`)
  if (boneNames.length) parts.push(`Bones: ${boneNames.join(', ')}.`)
  return {
    key: `joint:${joint.id}`,
    kind: 'joint',
    ids: [joint.id],
    title: joint.name,
    aliases: joint.alternateNames,
    text: parts.join(' '),
  }
}

function walkDoc(walk: Walk): AtlasDoc {
  const stops = walk.stops.map((stop, index) => `${index + 1}. ${stop.text}`).join(' ')
  return {
    key: `walk:${walk.id}`,
    kind: 'walk',
    ids: [walk.id],
    title: `Guided walk: ${walk.title}`,
    aliases: [],
    text: `${walk.summary} Stops: ${stops}`,
  }
}

function buildCorpus(): AtlasDoc[] {
  const docs: AtlasDoc[] = []
  const boneGroups = new Map<string, Bone[]>()
  for (const bone of bones) {
    const stem = sideless(bone.id)
    boneGroups.set(stem, [...(boneGroups.get(stem) ?? []), bone])
  }
  for (const group of boneGroups.values()) {
    const [first] = group
    if (!first) continue
    docs.push(
      boneDoc(
        first,
        group.map((bone) => bone.id),
      ),
    )
    first.landmarks.forEach((landmark, index) => {
      const ids = group.flatMap((bone) => bone.landmarks[index]?.id ?? [])
      docs.push(landmarkDoc(first, landmark, ids))
    })
  }
  for (const joint of joints) docs.push(jointDoc(joint))
  for (const walk of walks) docs.push(walkDoc(walk))
  return docs
}

export const atlasCorpus: readonly AtlasDoc[] = buildCorpus()

const byKey = new Map(atlasCorpus.map((doc) => [doc.key, doc]))
const byId = new Map<string, AtlasDoc>(
  atlasCorpus.flatMap((doc) => doc.ids.map((id) => [`${doc.kind}:${id}`, doc] as const)),
)

/** Finds a document by citation key or by any side-specific id, such as `bone:femur_right`. */
export function getDoc(key: string): AtlasDoc | undefined {
  return byKey.get(key) ?? byId.get(key)
}
