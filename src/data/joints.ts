import { contralateralId, getBone } from '@/data/bones'
import { getLandmark } from '@/data/landmarks'
import type { Joint } from '@/types/anatomy'

export const joints: Joint[] = [
  {
    id: 'sternoclavicular',
    name: 'Sternoclavicular joint',
    alternateNames: ['SC joint'],
    region: 'shoulder-girdle',
    description:
      'The sternoclavicular joint is a saddle synovial joint where the sternal end of the clavicle meets the clavicular notch of the manubrium. It is the only bony link between the upper limb and the axial skeleton.',
    movements: ['Elevation', 'Depression', 'Protraction', 'Retraction'],
    bones: ['sternum', 'clavicle_left'],
    landmarks: ['sternum_manubrium', 'clavicle_left_sternal'],
  },
  {
    id: 'acromioclavicular',
    name: 'Acromioclavicular joint',
    alternateNames: ['AC joint'],
    region: 'shoulder-girdle',
    description:
      'The acromioclavicular joint is a plane synovial joint between the acromial end of the clavicle and the acromion of the scapula. It lets the scapula glide on the clavicle as the arm is raised.',
    movements: ['Gliding', 'Rotation of the scapula'],
    bones: ['clavicle_left', 'scapula_left'],
    landmarks: ['clavicle_left_acromial', 'scapula_left_acromion'],
  },
  {
    id: 'glenohumeral',
    name: 'Glenohumeral joint',
    alternateNames: ['shoulder joint'],
    region: 'shoulder-girdle',
    description:
      'The glenohumeral joint is a ball-and-socket synovial joint between the glenoid cavity of the scapula and the head of the humerus. It is the most mobile joint of the upper limb.',
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Medial and lateral rotation'],
    bones: ['scapula_left', 'humerus_left'],
    landmarks: ['scapula_left_glenoid', 'humerus_left_head'],
  },
  {
    id: 'elbow',
    name: 'Elbow joint',
    alternateNames: ['cubital joint'],
    region: 'upper-limb',
    description:
      'The elbow joint is a hinge synovial joint between the trochlea and capitulum of the humerus and the proximal ends of the ulna and radius. It flexes and extends the forearm.',
    movements: ['Flexion', 'Extension'],
    bones: ['humerus_left', 'radius_left', 'ulna_left'],
    landmarks: ['humerus_left_capitulum', 'humerus_left_trochlea', 'radius_left_head', 'ulna_left_trochlear', 'ulna_left_olecranon'],
  },
  {
    id: 'wrist',
    name: 'Wrist joint',
    alternateNames: ['radiocarpal joint'],
    region: 'upper-limb',
    description:
      'The wrist joint is a condyloid synovial joint between the distal radius, the articular disc over the ulna, and the proximal surfaces of the scaphoid and lunate. It moves the hand on the forearm.',
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction'],
    bones: ['radius_left', 'ulna_left', 'scaphoid_left', 'lunate_left'],
    landmarks: ['radius_left_styloid', 'ulna_left_styloid', 'lunate_left_proximal'],
  },
  {
    id: 'temporomandibular',
    name: 'Temporomandibular joint',
    alternateNames: ['TMJ', 'jaw joint'],
    region: 'head',
    description:
      'The temporomandibular joint is a combined hinge and gliding synovial joint between the mandibular fossa of the temporal bone and the condylar process of the mandible. It opens, closes, and shifts the jaw.',
    movements: ['Elevation', 'Depression', 'Protrusion', 'Retraction', 'Side-to-side movement'],
    bones: ['temporal_left', 'mandible'],
    landmarks: ['temporal_left_mandibular_fossa', 'mandible_condyle'],
  },
  {
    id: 'atlanto_occipital',
    name: 'Atlanto-occipital joint',
    alternateNames: ['atlantooccipital joint'],
    region: 'vertebral-column',
    description:
      'The atlanto-occipital joint is a condyloid synovial joint between the occipital condyles and the superior facets of the atlas. It allows the head to nod on the vertebral column.',
    movements: ['Flexion', 'Extension', 'Lateral flexion'],
    bones: ['occipital', 'atlas'],
    landmarks: ['occipital_condyle', 'atlas_lateral_mass'],
  },
  {
    id: 'hip',
    name: 'Hip joint',
    alternateNames: ['coxal joint', 'acetabulofemoral joint'],
    region: 'lower-limb',
    description:
      'The hip joint is the ball-and-socket articulation between the acetabulum of the pelvic bone and the head of the femur.',
    movements: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Medial and lateral rotation'],
    bones: ['hip_bone_left', 'femur_left'],
    landmarks: ['hip_bone_left_acetabulum', 'femur_left_head'],
  },
  {
    id: 'knee',
    name: 'Knee joint',
    alternateNames: ['tibiofemoral joint'],
    region: 'lower-limb',
    description:
      'The knee joint is a modified hinge synovial joint between the femoral condyles, the tibial plateaus, and the patella. It is the main weight-bearing joint of the lower limb.',
    movements: ['Flexion', 'Extension'],
    bones: ['femur_left', 'tibia_left', 'patella_left'],
    landmarks: [
      'femur_left_medial_condyle',
      'femur_left_lateral_condyle',
      'tibia_left_medial_condyle',
      'tibia_left_lateral_condyle',
      'patella_left_articular',
    ],
  },
  {
    id: 'ankle',
    name: 'Ankle joint',
    alternateNames: ['talocrural joint'],
    region: 'lower-limb',
    description:
      'The ankle joint is a hinge synovial joint between the distal tibia and fibula and the trochlea of the talus. The malleoli form a mortise over the talus.',
    movements: ['Dorsiflexion', 'Plantarflexion'],
    bones: ['tibia_left', 'fibula_left', 'talus_left'],
    landmarks: ['tibia_left_medial_malleolus', 'fibula_left_lateral_malleolus', 'talus_left_trochlea'],
  },
  {
    id: 'pubic_symphysis',
    name: 'Pubic symphysis',
    alternateNames: ['symphysis pubis'],
    region: 'pelvis',
    description:
      'The pubic symphysis is a cartilaginous joint between the bodies of the two pubic bones. A fibrocartilage disc joins the pelvic bones in the anterior midline.',
    movements: ['Slight gliding'],
    bones: ['hip_bone_left', 'hip_bone_right'],
    landmarks: ['hip_bone_left_symphysis', 'hip_bone_right_symphysis'],
  },
  {
    id: 'sacroiliac',
    name: 'Sacroiliac joint',
    alternateNames: ['SI joint'],
    region: 'pelvis',
    description:
      'The sacroiliac joint is a synovial joint between the auricular surface of the sacrum and the auricular surface of the pelvic bone. It transfers weight from the vertebral column to the hip bone.',
    movements: ['Slight gliding', 'Slight rotation'],
    bones: ['sacrum', 'hip_bone_left'],
    landmarks: ['sacrum_auricular', 'hip_bone_left_auricular'],
  },
]

const byId = new Map(joints.map((joint) => [joint.id, joint]))

export function getJoint(id: string | null | undefined): Joint | undefined {
  if (!id) return undefined
  return byId.get(id)
}

/** A paired joint stores left-sided bones and mirrors to the right. Midline joints list every member. */
export function isPairedJoint(joint: Joint): boolean {
  let hasLeft = false
  let hasRight = false
  for (const id of joint.bones) {
    const bone = getBone(id)
    if (!bone) continue
    if (bone.side === 'left') hasLeft = true
    if (bone.side === 'right') hasRight = true
  }
  if (hasLeft && hasRight) return false
  return hasLeft || hasRight
}

export function resolveJointBones(joint: Joint, side: 'left' | 'right' = 'left'): string[] {
  const paired = isPairedJoint(joint)
  const resolved: string[] = []
  for (const id of joint.bones) {
    const bone = getBone(id)
    if (!bone) continue
    if (!paired || bone.side === 'midline' || bone.side === side) {
      resolved.push(bone.id)
      continue
    }
    const other = contralateralId(id)
    if (other && getBone(other)) resolved.push(other)
  }
  return resolved
}

function mirrorLandmarkId(id: string, side: 'left' | 'right'): string {
  if (side === 'left') return id
  if (id.includes('_left')) return id.replace('_left', '_right')
  return id
}

export function jointLandmarkIds(joint: Joint, side: 'left' | 'right' = 'left'): string[] {
  const paired = isPairedJoint(joint)
  const ids = joint.landmarks.map((id) => (paired ? mirrorLandmarkId(id, side) : id))
  return ids.filter((id) => getLandmark(id))
}

export function jointsForBone(boneId: string): Joint[] {
  return joints.filter((joint) => {
    if (resolveJointBones(joint, 'left').includes(boneId)) return true
    if (!isPairedJoint(joint)) return false
    return resolveJointBones(joint, 'right').includes(boneId)
  })
}
