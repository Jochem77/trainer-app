export type Step = {
  label: string
  duration_sec: number
  speed?: number
  repeat?: number
}

export type TrainingProgram = {
  id: string
  title: string
  steps: Step[]
}
