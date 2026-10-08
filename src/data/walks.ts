import { getBone } from '@/data/bones'
import { getJoint, resolveJointBones } from '@/data/joints'
import { getLandmark } from '@/data/landmarks'
import type { Walk, WalkStop } from '@/types/anatomy'

export const walks: Walk[] = [
  {
    id: 'shoulder_to_hand',
    title: 'Shoulder to hand',
    summary: 'Follow the upper limb from the clavicle to a finger bone.',
    stops: [
      {
        boneId: 'clavicle_left',
        text: 'The clavicle holds the shoulder away from the sternum. The next stop follows it back to the scapula.',
      },
      {
        boneId: 'scapula_left',
        text: 'The scapula sits on the back of the chest and meets the clavicle at the acromion. Its glenoid cavity faces the humerus.',
      },
      {
        boneId: 'scapula_left',
        jointId: 'glenohumeral',
        text: 'The scapula and humerus meet here. The next stop follows the humerus toward the elbow.',
      },
      {
        boneId: 'humerus_left',
        text: 'The humerus is the bone of the arm. Its distal end forms the upper half of the elbow.',
      },
      {
        boneId: 'humerus_left',
        jointId: 'elbow',
        text: 'The humerus meets the radius and ulna at the elbow. The next stops follow the two bones of the forearm.',
      },
      {
        boneId: 'radius_left',
        text: 'The radius is the lateral bone of the forearm. It widens at the wrist to meet the carpal bones.',
      },
      {
        boneId: 'ulna_left',
        text: 'The ulna is the medial bone of the forearm. It stabilizes the elbow and narrows toward the wrist.',
      },
      {
        boneId: 'scaphoid_left',
        text: 'The scaphoid is the lateral bone of the proximal carpal row and meets the radius. The hand continues into the metacarpals.',
      },
      {
        boneId: 'metacarpals_left',
        text: 'The metacarpals form the palm. Each head meets a proximal phalanx.',
      },
      {
        boneId: 'hand_phalanges_left',
        text: 'The phalanges are the bones of the fingers. This is the last stop on the path from the shoulder to the hand.',
      },
    ],
  },
  {
    id: 'hip_to_foot',
    title: 'Hip to foot',
    summary: 'Follow the lower limb from the pelvic bone to the metatarsals.',
    stops: [
      {
        boneId: 'hip_bone_left',
        text: 'The pelvic bone forms the socket of the hip. The next stop is the joint it shares with the femur.',
      },
      {
        boneId: 'hip_bone_left',
        jointId: 'hip',
        text: 'The acetabulum and the femoral head meet here. The next stop follows the femur toward the knee.',
      },
      {
        boneId: 'femur_left',
        text: 'The femur carries weight from the hip to the knee. Its distal condyles meet the tibia and the patella.',
      },
      {
        boneId: 'patella_left',
        text: 'The patella sits in the quadriceps tendon against the front of the femur. The next stop is the knee joint itself.',
      },
      {
        boneId: 'femur_left',
        jointId: 'knee',
        text: 'The femur, tibia, and patella meet here. The next stops follow the two bones of the leg.',
      },
      {
        boneId: 'tibia_left',
        text: 'The tibia is the medial bone of the leg and carries weight down to the ankle.',
      },
      {
        boneId: 'fibula_left',
        text: 'The fibula is the slender lateral bone of the leg. Its distal end forms the lateral side of the ankle.',
      },
      {
        boneId: 'tibia_left',
        jointId: 'ankle',
        text: 'The tibia and fibula form a mortise over the talus. The next stop is the talus itself.',
      },
      {
        boneId: 'talus_left',
        text: 'The talus receives the ankle mortise and passes weight into the foot. The next stop moves forward to the metatarsals.',
      },
      {
        boneId: 'metatarsals_left',
        text: 'The metatarsals form the front of the foot. This is the last stop on the path from the hip to the foot.',
      },
    ],
  },
  {
    id: 'vertebral_column',
    title: 'Vertebral column',
    summary: 'Walk the column from the atlas down to the coccyx.',
    stops: [
      {
        boneId: 'atlas',
        text: 'The atlas is the first cervical vertebra and supports the skull. The next stop is the axis, which lets the head rotate.',
      },
      {
        boneId: 'axis',
        text: 'The axis is the second cervical vertebra. Its dens forms a pivot with the atlas. The typical cervical vertebrae follow.',
      },
      {
        boneId: 'cervical_vertebrae',
        text: 'The remaining cervical vertebrae continue the neck. The column then enters the thorax.',
      },
      {
        boneId: 'thoracic_vertebrae',
        text: 'The thoracic vertebrae carry the ribs. The next stop is the lumbar column in the lower back.',
      },
      {
        boneId: 'lumbar_vertebrae',
        text: 'The lumbar vertebrae are the largest movable vertebrae. They meet the sacrum below.',
      },
      {
        boneId: 'sacrum',
        text: 'The sacrum is five fused vertebrae that lock the column to the pelvis. The coccyx continues below it.',
      },
      {
        boneId: 'coccyx',
        text: 'The coccyx is the small terminal bone of the vertebral column.',
      },
    ],
  },
  {
    id: 'cranial_vault',
    title: 'Cranial vault',
    summary: 'Move across the bones that enclose the cranial cavity.',
    stops: [
      {
        boneId: 'frontal',
        text: 'The frontal bone forms the forehead and the roof of each orbit. The parietal bones continue behind it.',
      },
      {
        boneId: 'parietal_left',
        text: 'The parietal bone forms much of the cranial roof. The temporal bone meets it along the side of the skull.',
      },
      {
        boneId: 'temporal_left',
        text: 'The temporal bone forms the side of the vault and houses the ear. The occipital bone closes the vault behind.',
      },
      {
        boneId: 'occipital',
        text: 'The occipital bone forms the back and base of the cranial vault. The sphenoid sits ahead of it in the base.',
      },
      {
        boneId: 'sphenoid',
        text: 'The sphenoid spans the floor of the cranial cavity and meets the other vault bones. This is the last stop.',
      },
    ],
  },
  {
    id: 'hip_joint_bones',
    title: 'Bones of the hip joint',
    summary: 'Name the socket, the ball, and the joint they form.',
    stops: [
      {
        boneId: 'hip_bone_left',
        text: 'The pelvic bone contributes the socket of the hip. The next stop is the acetabulum on that bone.',
      },
      {
        boneId: 'hip_bone_left',
        landmarkId: 'hip_bone_left_acetabulum',
        text: 'The acetabulum is the deep socket on the lateral pelvic bone. The femur supplies the ball that fits it.',
      },
      {
        boneId: 'femur_left',
        text: 'The femur is the bone of the thigh. Its head is the ball of the hip joint.',
      },
      {
        boneId: 'femur_left',
        landmarkId: 'femur_left_head',
        text: 'The head of the femur is the smooth sphere that sits in the acetabulum. The next stop names the joint they form.',
      },
      {
        boneId: 'hip_bone_left',
        jointId: 'hip',
        text: 'The hip joint is the ball-and-socket meeting of the acetabulum and the femoral head.',
      },
    ],
  },
  {
    id: 'knee_bones',
    title: 'Bones of the knee',
    summary: 'Follow the femur, its condyles, the patella, and the tibia into the knee joint.',
    stops: [
      {
        boneId: 'femur_left',
        text: 'The femur ends in two condyles that form the upper surface of the knee.',
      },
      {
        boneId: 'femur_left',
        landmarkId: 'femur_left_medial_condyle',
        text: 'The medial femoral condyle is the larger distal knuckle. It meets the medial tibial plateau.',
      },
      {
        boneId: 'femur_left',
        landmarkId: 'femur_left_lateral_condyle',
        text: 'The lateral femoral condyle meets the lateral tibial plateau and, in front, the patella.',
      },
      {
        boneId: 'patella_left',
        text: 'The patella glides on the front of the femoral condyles as the knee bends.',
      },
      {
        boneId: 'tibia_left',
        text: 'The tibia receives both femoral condyles on its plateaus. Together these bones form the knee joint.',
      },
      {
        boneId: 'femur_left',
        jointId: 'knee',
        text: 'The knee joint is the meeting of the femur, tibia, and patella.',
      },
    ],
  },
]

const byId = new Map(walks.map((walk) => [walk.id, walk]))

export function getWalk(id: string | null | undefined): Walk | undefined {
  if (!id) return undefined
  return byId.get(id)
}

export function stopResolves(stop: WalkStop): boolean {
  if (!getBone(stop.boneId)) return false
  if (stop.landmarkId && !getLandmark(stop.landmarkId)) return false
  if (stop.jointId) {
    const joint = getJoint(stop.jointId)
    if (!joint || resolveJointBones(joint, 'left').length === 0) return false
  }
  return true
}

export function resolvedStops(walk: Walk): WalkStop[] {
  return walk.stops.filter(stopResolves)
}
