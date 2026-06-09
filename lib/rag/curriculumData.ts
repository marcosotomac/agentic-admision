export interface Course {
  name: string
  credits: number
  area: "especialidad" | "ciencias" | "gestion"
}

export interface Cycle {
  number: number
  courses: Course[]
}

export interface CurriculumData {
  career: string
  credits: number
  duration: string
  cycles: Cycle[]
  mentions?: string[]
  certifications?: string[]
}

export const staticCurriculums: Record<string, CurriculumData> = {
  "Ingeniería de Software": {
    career: "Ingeniería de Software",
    credits: 200,
    duration: "10 semestres (5 años)",
    mentions: [
      "Analítica de datos no estructurados",
      "Robótica e Inteligencia Artificial",
      "Redes y telecomunicaciones avanzadas",
      "Gestión Integral de la Sostenibilidad"
    ],
    certifications: [
      "Doble Grado Americano con San Ignacio University (Miami)",
      "Certificación Internacional IEEE",
      "Convenios con AWS, Huawei, Cisco, Oracle"
    ],
    cycles: [
      {
        number: 1,
        courses: [
          { name: "Fundamentos de Programación", credits: 4, area: "especialidad" },
          { name: "Fundamentos en Competencias Digitales", credits: 3, area: "ciencias" },
          { name: "Matemática", credits: 4, area: "ciencias" },
          { name: "Lenguaje y Comunicación I", credits: 3, area: "gestion" },
          { name: "Realidad Nacional y Globalización", credits: 3, area: "gestion" },
          { name: "English I", credits: 2, area: "gestion" }
        ]
      },
      {
        number: 2,
        courses: [
          { name: "Programación Orientada a Objetos I", credits: 4, area: "especialidad" },
          { name: "Matemática Discreta", credits: 4, area: "ciencias" },
          { name: "Cálculo de Una Variable", credits: 4, area: "ciencias" },
          { name: "Lenguaje y Comunicación II", credits: 3, area: "gestion" },
          { name: "Administración para los Negocios", credits: 3, area: "gestion" },
          { name: "English II", credits: 2, area: "gestion" }
        ]
      },
      {
        number: 3,
        courses: [
          { name: "Programación y Estructuras de Datos", credits: 4, area: "especialidad" },
          { name: "Ingeniería de Software I", credits: 4, area: "especialidad" },
          { name: "Álgebra Lineal Computacional", credits: 4, area: "ciencias" },
          { name: "Teoría de Computación", credits: 3, area: "ciencias" },
          { name: "Principios de Economía", credits: 3, area: "gestion" },
          { name: "English III", credits: 2, area: "gestion" }
        ]
      },
      {
        number: 4,
        courses: [
          { name: "Estructuras de Datos Avanzada", credits: 4, area: "especialidad" },
          { name: "Estadística Descriptiva e Inferencia Estadística", credits: 4, area: "ciencias" },
          { name: "Gerenciamiento de Datos I", credits: 4, area: "especialidad" },
          { name: "Experiencia de Usuario (UX)", credits: 3, area: "especialidad" },
          { name: "Fundamentos Contables y Financieros", credits: 3, area: "gestion" },
          { name: "English IV", credits: 2, area: "gestion" }
        ]
      },
      {
        number: 5,
        courses: [
          { name: "Programación Orientada a Objetos II", credits: 4, area: "especialidad" },
          { name: "Ingeniería de Software II", credits: 4, area: "especialidad" },
          { name: "Gerenciamiento de Datos II", credits: 4, area: "especialidad" },
          { name: "Interacción Humano Computador", credits: 3, area: "especialidad" },
          { name: "Ética y Ciudadanía", credits: 2, area: "gestion" },
          { name: "Marketing", credits: 3, area: "gestion" }
        ]
      },
      {
        number: 6,
        courses: [
          { name: "Ingeniería de Software III", credits: 4, area: "especialidad" },
          { name: "Programación Competitiva", credits: 3, area: "especialidad" },
          { name: "Análisis y Diseño de Algoritmos", credits: 4, area: "ciencias" },
          { name: "Sistemas Operativos", credits: 4, area: "ciencias" },
          { name: "Metodología de la Investigación Científica", credits: 3, area: "ciencias" },
          { name: "Electivo 1", credits: 3, area: "especialidad" }
        ]
      },
      {
        number: 7,
        courses: [
          { name: "Desarrollo Basado en Plataformas", credits: 4, area: "especialidad" },
          { name: "Gestión de Sistemas de Información", credits: 3, area: "gestion" },
          { name: "Compiladores", credits: 4, area: "ciencias" },
          { name: "Redes y Telecomunicaciones I", credits: 4, area: "ciencias" },
          { name: "Fundamentos del Liderazgo Sostenible", credits: 2, area: "gestion" },
          { name: "Electivo 2", credits: 3, area: "especialidad" }
        ]
      },
      {
        number: 8,
        courses: [
          { name: "Agentes Inteligentes", credits: 4, area: "especialidad" },
          { name: "Seguridad de la Información", credits: 4, area: "especialidad" },
          { name: "Gestión de Proyectos para Computación", credits: 3, area: "gestion" },
          { name: "Cloud Computing", credits: 3, area: "especialidad" },
          { name: "Oportunidades de Negocios", credits: 3, area: "gestion" },
          { name: "Electivo 3", credits: 3, area: "especialidad" }
        ]
      },
      {
        number: 9,
        courses: [
          { name: "Internet of Things", credits: 3, area: "especialidad" },
          { name: "Visualización de Datos", credits: 3, area: "especialidad" },
          { name: "Proyecto para Computación I", credits: 4, area: "especialidad" },
          { name: "Tecnologías Emergentes", credits: 3, area: "especialidad" },
          { name: "Computación en la Sociedad", credits: 2, area: "gestion" },
          { name: "Electivo 4", credits: 3, area: "especialidad" }
        ]
      },
      {
        number: 10,
        courses: [
          { name: "Big Data y Analítica de Datos", credits: 3, area: "especialidad" },
          { name: "Estrategias de Sistemas de Información", credits: 3, area: "gestion" },
          { name: "Proyecto para Computación II", credits: 6, area: "especialidad" },
          { name: "Emprendimiento e Innovación Tecnológica", credits: 3, area: "gestion" },
          { name: "Desarrollo de Negocios Electrónicos", credits: 3, area: "gestion" },
          { name: "Electivo 5", credits: 3, area: "especialidad" }
        ]
      }
    ]
  },
  "Medicina Humana": {
    career: "Medicina Humana",
    credits: 310,
    duration: "14 semestres (7 años)",
    mentions: [
      "Atención Primaria y Salud Comunitaria",
      "Tecnología e Inteligencia Artificial en Diagnóstico Médico",
      "Gestión de Instituciones de Salud"
    ],
    certifications: [
      "Convenios con Hospitales y Clínicas de primer nivel en el Perú",
      "Internado médico garantizado y rotaciones internacionales",
      "Simulación clínica interactiva en laboratorios acreditados"
    ],
    cycles: [
      {
        number: 1,
        courses: [
          { name: "Introducción a la Medicina", credits: 2, area: "especialidad" },
          { name: "Biología Celular y Molecular", credits: 4, area: "ciencias" },
          { name: "Química General", credits: 4, area: "ciencias" },
          { name: "Matemática Aplicada", credits: 3, area: "ciencias" },
          { name: "Lenguaje y Redacción Médica", credits: 3, area: "gestion" },
          { name: "Realidad Nacional y Globalización", credits: 3, area: "gestion" }
        ]
      },
      {
        number: 2,
        courses: [
          { name: "Anatomía Humana I", credits: 6, area: "especialidad" },
          { name: "Biofísica Médica", credits: 4, area: "ciencias" },
          { name: "Histología y Embriología Humana", credits: 5, area: "ciencias" },
          { name: "Salud Pública y Epidemiología I", credits: 3, area: "gestion" },
          { name: "Antropología Médica y Ética", credits: 2, area: "gestion" }
        ]
      },
      {
        number: 3,
        courses: [
          { name: "Anatomía Humana II", credits: 6, area: "especialidad" },
          { name: "Fisiología Humana I", credits: 6, area: "especialidad" },
          { name: "Bioquímica Médica", credits: 5, area: "ciencias" },
          { name: "Metodología de la Investigación", credits: 3, area: "ciencias" }
        ]
      },
      {
        number: 4,
        courses: [
          { name: "Fisiología Humana II", credits: 6, area: "especialidad" },
          { name: "Microbiología y Parasitología", credits: 5, area: "ciencias" },
          { name: "Patología General", credits: 5, area: "especialidad" },
          { name: "Salud Pública y Epidemiología II", credits: 3, area: "gestion" }
        ]
      },
      {
        number: 5,
        courses: [
          { name: "Farmacología Médica I", credits: 4, area: "especialidad" },
          { name: "Inmunología Clínica", credits: 4, area: "especialidad" },
          { name: "Semióloga Médica y Fisiopatología I", credits: 7, area: "especialidad" },
          { name: "Nutrición y Dietoterapia", credits: 3, area: "ciencias" }
        ]
      },
      {
        number: 6,
        courses: [
          { name: "Farmacología Médica II", credits: 4, area: "especialidad" },
          { name: "Genética y Genómica Médica", credits: 3, area: "ciencias" },
          { name: "Semióloga Médica y Fisiopatología II", credits: 7, area: "especialidad" },
          { name: "Psicología Médica y Salud Mental", credits: 3, area: "gestion" }
        ]
      },
      {
        number: 7,
        courses: [
          { name: "Medicina Interna I (Cardiología, Neumología, Nefrología)", credits: 8, area: "especialidad" },
          { name: "Cirugía General I", credits: 6, area: "especialidad" },
          { name: "Diagnóstico por Imágenes", credits: 3, area: "especialidad" }
        ]
      },
      {
        number: 8,
        courses: [
          { name: "Medicina Interna II (Gastroenterología, Endocrinología, Reumatología)", credits: 8, area: "especialidad" },
          { name: "Cirugía General II (Urología, Traumatología)", credits: 6, area: "especialidad" },
          { name: "Medicina Laboral y Salud Ocupacional", credits: 3, area: "gestion" }
        ]
      },
      {
        number: 9,
        courses: [
          { name: "Pediatría I", credits: 7, area: "especialidad" },
          { name: "Gineco-Obstetricia I", credits: 7, area: "especialidad" },
          { name: "Psiquiatría y Neurología", credits: 4, area: "especialidad" }
        ]
      },
      {
        number: 10,
        courses: [
          { name: "Pediatría II", credits: 7, area: "especialidad" },
          { name: "Gineco-Obstetricia II", credits: 7, area: "especialidad" },
          { name: "Geriatría y Cuidados Paliativos", credits: 4, area: "especialidad" }
        ]
      },
      {
        number: 11,
        courses: [
          { name: "Medicina de Emergencia y Desastres", credits: 6, area: "especialidad" },
          { name: "Medicina Forense y Bioética", credits: 3, area: "gestion" },
          { name: "Administración y Gestión de Servicios de Salud", credits: 4, area: "gestion" },
          { name: "Tesis I", credits: 4, area: "ciencias" }
        ]
      },
      {
        number: 12,
        courses: [
          { name: "Proyecto Social en Salud (SERUMS)", credits: 6, area: "gestion" },
          { name: "Integración de Ciencias Clínicas", credits: 6, area: "especialidad" },
          { name: "Tesis II", credits: 4, area: "ciencias" }
        ]
      },
      {
        number: 13,
        courses: [
          { name: "Internado Médico I: Medicina Interna y Cirugía", credits: 15, area: "especialidad" }
        ]
      },
      {
        number: 14,
        courses: [
          { name: "Internado Médico II: Pediatría y Obstetricia", credits: 15, area: "especialidad" }
        ]
      }
    ]
  }
}
