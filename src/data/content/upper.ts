import type { Bone } from '@/types/anatomy'
import { paired } from './helpers'

const carpal = (
  stem: string,
  name: string,
  mesh: string,
  description: string,
  articulations: string[],
  landmarks: Parameters<typeof paired>[2]['landmarks'],
) =>
  paired(stem, name, {
    region: 'upper-limb',
    classification: 'short',
    primaryMesh: mesh,
    quiz: true,
    keywords: ['wrist', 'carpus', 'carpal'],
    description,
    articulations,
    landmarks,
  })

export const upperBones: Bone[] = [
  ...paired('clavicle', 'Clavicle', {
    region: 'shoulder-girdle',
    classification: 'long',
    primaryMesh: 'Clavicle.r',
    quiz: true,
    alternateNames: ['collarbone'],
    keywords: ['shoulder', 'pectoral girdle', 'collarbone'],
    description:
      'A slender long bone that braces the shoulder against the sternum. Its medial end is convex anteriorly and its lateral end is concave anteriorly.',
    articulations: ['Sternum', 'Scapula, at the acromion'],
    landmarks: [
      {
        suffix: 'sternal',
        name: 'Sternal end',
        description: 'The bulky medial end that articulates with the clavicular notch of the manubrium.',
        anchor: [0.04, 0.45, 0.62],
      },
      {
        suffix: 'acromial',
        name: 'Acromial end',
        description: 'The flattened lateral end that meets the acromion of the scapula.',
        anchor: [0.96, 0.55, 0.4],
      },
      {
        suffix: 'shaft',
        name: 'Shaft',
        description: 'The S-shaped body. The medial two-thirds are rounded and the lateral third is flat.',
        anchor: [0.5, 0.6, 0.7],
      },
      {
        suffix: 'conoid',
        name: 'Conoid tubercle',
        description: 'A prominence on the inferior surface of the lateral third. The conoid ligament attaches here.',
        anchor: [0.78, 0.15, 0.35],
      },
    ],
  }),
  ...paired('scapula', 'Scapula', {
    region: 'shoulder-girdle',
    classification: 'flat',
    primaryMesh: 'Scapula.r.',
    quiz: true,
    alternateNames: ['shoulder blade'],
    keywords: ['shoulder', 'pectoral girdle', 'shoulder blade'],
    description:
      'A flat triangular bone on the posterior thoracic wall. It links the humerus to the clavicle and provides a broad surface for muscles of the shoulder.',
    articulations: ['Humerus', 'Clavicle'],
    landmarks: [
      {
        suffix: 'spine',
        name: 'Spine',
        description: 'A prominent ridge on the posterior surface that divides the supra- and infraspinous fossae and continues laterally as the acromion.',
        anchor: [0.55, 0.72, 0.08],
      },
      {
        suffix: 'acromion',
        name: 'Acromion',
        description: 'The flattened lateral end of the spine. It articulates with the clavicle and roofs the shoulder joint.',
        anchor: [0.92, 0.82, 0.35],
      },
      {
        suffix: 'coracoid',
        name: 'Coracoid process',
        description: 'A hook-like process projecting anteriorly. Pectoralis minor, coracobrachialis, and the short head of biceps attach here.',
        anchor: [0.7, 0.7, 0.9],
      },
      {
        suffix: 'glenoid',
        name: 'Glenoid cavity',
        description: 'The shallow lateral socket for the head of the humerus.',
        anchor: [0.98, 0.48, 0.55],
      },
      {
        suffix: 'supra',
        name: 'Supraspinous fossa',
        description: 'The depression above the spine. Supraspinatus originates here.',
        anchor: [0.4, 0.88, 0.2],
      },
      {
        suffix: 'infra',
        name: 'Infraspinous fossa',
        description: 'The large depression below the spine. Infraspinatus originates here.',
        anchor: [0.35, 0.35, 0.15],
      },
    ],
  }),
  ...paired('humerus', 'Humerus', {
    region: 'upper-limb',
    classification: 'long',
    primaryMesh: 'Humerus.r',
    quiz: true,
    keywords: ['arm', 'upper limb', 'brachium'],
    description:
      'The bone of the arm, from shoulder to elbow. The head faces medially into the glenoid cavity, and the distal end forms the condyle of the elbow.',
    articulations: ['Scapula', 'Radius', 'Ulna'],
    landmarks: [
      {
        suffix: 'head',
        name: 'Head',
        description: 'The rounded proximal articular surface, directed medially, superiorly, and slightly posteriorly.',
        anchor: [0.12, 0.94, 0.55],
      },
      {
        suffix: 'greater_tubercle',
        name: 'Greater tubercle',
        description: 'The lateral proximal prominence. Supraspinatus, infraspinatus, and teres minor insert here.',
        anchor: [0.9, 0.86, 0.45],
      },
      {
        suffix: 'surgical_neck',
        name: 'Surgical neck',
        description: 'The narrowed region below the tubercles. It is a common fracture site.',
        significance: 'The axillary nerve and posterior circumflex humeral vessels run against the surgical neck.',
        anchor: [0.5, 0.72, 0.5],
      },
      {
        suffix: 'deltoid',
        name: 'Deltoid tuberosity',
        description: 'A roughened elevation on the lateral shaft for insertion of deltoid.',
        anchor: [0.78, 0.48, 0.4],
      },
      {
        suffix: 'capitulum',
        name: 'Capitulum',
        description: 'The rounded lateral part of the condyle. It articulates with the head of the radius.',
        anchor: [0.78, 0.06, 0.75],
      },
      {
        suffix: 'trochlea',
        name: 'Trochlea',
        description: 'The spool-shaped medial part of the condyle. It articulates with the trochlear notch of the ulna.',
        anchor: [0.22, 0.05, 0.62],
      },
      {
        suffix: 'olecranon_fossa',
        name: 'Olecranon fossa',
        description: 'A deep posterior hollow that receives the olecranon of the ulna in extension.',
        anchor: [0.45, 0.1, 0.06],
      },
      {
        suffix: 'medial_epicondyle',
        name: 'Medial epicondyle',
        description: 'The subcutaneous medial projection. The ulnar nerve passes behind it.',
        anchor: [0.02, 0.14, 0.5],
      },
    ],
  }),
  ...paired('radius', 'Radius', {
    region: 'upper-limb',
    classification: 'long',
    primaryMesh: 'Radius.r',
    quiz: true,
    keywords: ['forearm', 'upper limb', 'thumb side'],
    description:
      'The lateral bone of the forearm in anatomical position. Its proximal disc articulates with the capitulum, and its broad distal end forms most of the wrist joint.',
    articulations: ['Humerus', 'Ulna', 'Scaphoid', 'Lunate'],
    landmarks: [
      {
        suffix: 'head',
        name: 'Head',
        description: 'The proximal disc. Its superior surface meets the capitulum and its circumference meets the radial notch of the ulna.',
        anchor: [0.45, 0.97, 0.55],
      },
      {
        suffix: 'tuberosity',
        name: 'Radial tuberosity',
        description: 'A medial roughness just distal to the neck. The biceps tendon inserts here.',
        anchor: [0.2, 0.82, 0.55],
      },
      {
        suffix: 'shaft',
        name: 'Shaft',
        description: 'The body, which widens toward the wrist and carries the interosseous border medially.',
        anchor: [0.55, 0.45, 0.4],
      },
      {
        suffix: 'styloid',
        name: 'Styloid process',
        description: 'The pointed lateral end of the distal radius. It projects farther distally than the ulnar styloid.',
        anchor: [0.92, 0.04, 0.55],
      },
    ],
  }),
  ...paired('ulna', 'Ulna', {
    region: 'upper-limb',
    classification: 'long',
    primaryMesh: 'Ulna.r',
    quiz: true,
    keywords: ['forearm', 'upper limb', 'elbow'],
    description:
      'The medial bone of the forearm. It forms the point of the elbow and stabilizes the elbow joint; its distal end is narrow.',
    articulations: ['Humerus', 'Radius'],
    landmarks: [
      {
        suffix: 'olecranon',
        name: 'Olecranon',
        description: 'The proximal posterior process that forms the tip of the elbow and receives the triceps tendon.',
        anchor: [0.45, 0.96, 0.08],
      },
      {
        suffix: 'coronoid',
        name: 'Coronoid process',
        description: 'The anterior lip of the trochlear notch. Brachialis inserts on its tuberosity.',
        anchor: [0.4, 0.78, 0.9],
      },
      {
        suffix: 'trochlear',
        name: 'Trochlear notch',
        description: 'The deep anterior concavity, between olecranon and coronoid process, that grips the trochlea.',
        anchor: [0.45, 0.86, 0.55],
      },
      {
        suffix: 'styloid',
        name: 'Styloid process',
        description: 'A small distal projection on the posteromedial end of the head.',
        anchor: [0.2, 0.04, 0.4],
      },
    ],
  }),
  ...carpal(
    'scaphoid',
    'Scaphoid',
    'Scaphoid.r',
    'A boat-shaped bone of the proximal carpal row, on the lateral side of the wrist. It articulates with the radius and spans both carpal rows.',
    ['Radius', 'Lunate', 'Trapezium', 'Trapezoid', 'Capitate'],
    [
      {
        suffix: 'tubercle',
        name: 'Tubercle',
        description: 'A palmar prominence, palpable in the anatomical snuffbox region, that gives attachment to the flexor retinaculum.',
        anchor: [0.7, 0.35, 0.9],
      },
      {
        suffix: 'waist',
        name: 'Waist',
        description: 'The narrowed middle of the bone, the usual site of a scaphoid fracture.',
        significance: 'Blood supply enters largely from the distal end, so a waist fracture can leave the proximal pole at risk of avascular necrosis.',
        anchor: [0.5, 0.55, 0.5],
      },
    ],
  ),
  ...carpal(
    'lunate',
    'Lunate',
    'Lunate bone.r',
    'A crescent-shaped bone in the center of the proximal carpal row. Its proximal surface articulates with the radius.',
    ['Radius', 'Scaphoid', 'Triquetrum', 'Capitate', 'Hamate'],
    [
      {
        suffix: 'proximal',
        name: 'Proximal surface',
        description: 'The convex surface that meets the distal radius.',
        anchor: [0.45, 0.92, 0.45],
      },
    ],
  ),
  ...carpal(
    'triquetrum',
    'Triquetrum',
    'Triquetrum.r',
    'A pyramidal bone on the medial side of the proximal carpal row. The pisiform sits against its palmar surface.',
    ['Lunate', 'Hamate', 'Pisiform'],
    [
      {
        suffix: 'body',
        name: 'Body',
        description: 'The pyramidal mass medial to the lunate.',
        anchor: [0.4, 0.55, 0.4],
      },
    ],
  ),
  ...carpal(
    'pisiform',
    'Pisiform',
    'Pisiform.r',
    'A small pea-shaped sesamoid bone in the tendon of flexor carpi ulnaris. It lies anterior to the triquetrum and forms part of the ulnar carpal tunnel boundary.',
    ['Triquetrum'],
    [
      {
        suffix: 'body',
        name: 'Body',
        description: 'The subcutaneous palmar knob at the medial base of the hand.',
        anchor: [0.5, 0.55, 0.85],
      },
    ],
  ),
  ...carpal(
    'trapezium',
    'Trapezium',
    'Trapezium.r',
    'A distal-row carpal at the base of the thumb. Its saddle-shaped facet meets the first metacarpal.',
    ['Scaphoid', 'Trapezoid', 'First and second metacarpals'],
    [
      {
        suffix: 'saddle',
        name: 'Saddle surface',
        description: 'The distal articular surface for the first metacarpal, which allows opposition of the thumb.',
        anchor: [0.7, 0.15, 0.55],
      },
    ],
  ),
  ...carpal(
    'trapezoid',
    'Trapezoid',
    'Trapezoid.r',
    'A small wedge in the distal carpal row, between the trapezium and the capitate. It supports the second metacarpal.',
    ['Scaphoid', 'Trapezium', 'Capitate', 'Second metacarpal'],
    [
      {
        suffix: 'body',
        name: 'Body',
        description: 'The wedge-shaped bone at the base of the index metacarpal.',
        anchor: [0.5, 0.5, 0.5],
      },
    ],
  ),
  ...carpal(
    'capitate',
    'Capitate',
    'Capitate.r',
    'The largest carpal bone, sitting in the center of the wrist. Its head fits into the concavity formed by the scaphoid and lunate.',
    ['Scaphoid', 'Lunate', 'Trapezoid', 'Hamate', 'Second, third, and fourth metacarpals'],
    [
      {
        suffix: 'head',
        name: 'Head',
        description: 'The rounded proximal portion received by the scaphoid and lunate.',
        anchor: [0.5, 0.9, 0.5],
      },
    ],
  ),
  ...carpal(
    'hamate',
    'Hamate',
    'Hamate.r',
    'The medial bone of the distal carpal row. A hook projects from its palmar surface.',
    ['Lunate', 'Triquetrum', 'Capitate', 'Fourth and fifth metacarpals'],
    [
      {
        suffix: 'hook',
        name: 'Hook',
        description: 'The hamulus, a palmar projection that anchors the flexor retinaculum and is palpable in the hypothenar region.',
        significance: 'The ulnar nerve passes just lateral to the hook and can be compressed there.',
        anchor: [0.45, 0.4, 0.92],
      },
    ],
  ),
  ...paired('metacarpals', 'Metacarpals', {
    region: 'upper-limb',
    classification: 'long',
    primaryMesh: '3rd metacarpal bone.r',
    quiz: true,
    keywords: ['hand', 'palm'],
    description:
      'Five long bones of the palm, numbered I to V from the thumb side. Each has a base, shaft, and head. The first metacarpal is rotated and forms a saddle joint with the trapezium.',
    articulations: ['Distal carpals', 'Proximal phalanges', 'Adjacent metacarpals, except the first'],
    landmarks: [
      {
        suffix: 'base',
        name: 'Base',
        description: 'The proximal end, illustrated on the third metacarpal, which articulates with the capitate.',
        mesh: '3rd metacarpal bone.r',
        anchor: [0.5, 0.92, 0.45],
      },
      {
        suffix: 'shaft',
        name: 'Shaft',
        description: 'The slender body. The palmar surface is slightly concave.',
        mesh: '3rd metacarpal bone.r',
        anchor: [0.5, 0.5, 0.55],
      },
      {
        suffix: 'head',
        name: 'Head',
        description: 'The rounded distal end that forms the knuckle and meets a proximal phalanx.',
        mesh: '3rd metacarpal bone.r',
        anchor: [0.5, 0.06, 0.6],
      },
      {
        suffix: 'first',
        name: 'First metacarpal',
        description: 'The metacarpal of the thumb. It is shorter and set apart from the others so the thumb can oppose.',
        mesh: '1st metacarpal bone.r',
        anchor: [0.55, 0.5, 0.6],
      },
    ],
  }),
  ...paired('hand_phalanges', 'Phalanges of the hand', {
    region: 'upper-limb',
    classification: 'long',
    primaryMesh: 'Proximal phalanx of 3rd finger.r',
    quiz: true,
    alternateNames: ['finger bones', 'manual phalanges'],
    keywords: ['hand', 'fingers', 'digits'],
    description:
      'The bones of the fingers. Digits II–V have proximal, middle, and distal phalanges. The thumb has only a proximal and a distal phalanx.',
    articulations: ['Metacarpals', 'Adjacent phalanges'],
    landmarks: [
      {
        suffix: 'proximal',
        name: 'Proximal phalanx',
        description: 'The phalanx nearest the palm. Its base meets a metacarpal head.',
        mesh: 'Proximal phalanx of 3rd finger.r',
        anchor: [0.5, 0.7, 0.55],
      },
      {
        suffix: 'middle',
        name: 'Middle phalanx',
        description: 'Present in the four fingers and absent in the thumb.',
        mesh: 'Middle phalanx of 3rd finger.r',
        anchor: [0.5, 0.55, 0.55],
      },
      {
        suffix: 'distal',
        name: 'Distal phalanx',
        description: 'The bone of the fingertip. Its palmar surface supports the pulp, and its dorsal surface supports the nail.',
        mesh: 'Distal phalanx of 3d finger.r',
        anchor: [0.5, 0.35, 0.6],
      },
    ],
  }),
  ...paired('hand_sesamoids', 'Sesamoid bones of the hand', {
    region: 'upper-limb',
    classification: 'sesamoid',
    primaryMesh: 'Sesamoid_bones_of_hand.r',
    quiz: false,
    keywords: ['hand', 'thumb', 'sesamoid'],
    description:
      'Small bones embedded in tendons at the thumb metacarpophalangeal joint. They sit in the tendons of flexor pollicis brevis and adductor pollicis and protect the tendon of flexor pollicis longus.',
    articulations: ['Head of the first metacarpal'],
    landmarks: [],
  }),
]
