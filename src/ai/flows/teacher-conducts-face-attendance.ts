'use server';
/**
 * @fileOverview This file implements a Genkit flow for a teacher to conduct
 * attendance using face recognition. It defines a tool that simulates
 * a face recognition microservice, which the main flow orchestrates.
 *
 * - teacherConductsFaceAttendance - The main function to initiate face-based attendance.
 * - TeacherConductsFaceAttendanceInput - The input type for the attendance function.
 * - TeacherConductsFaceAttendanceOutput - The return type for the attendance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TeacherConductsFaceAttendanceInputSchema = z.object({
  webcamFrameDataUri: z
    .string()
    .describe(
      "A webcam frame captured as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  classId: z.string().describe('The ID of the class for which attendance is being taken.'),
});
export type TeacherConductsFaceAttendanceInput = z.infer<
  typeof TeacherConductsFaceAttendanceInputSchema
>;

const TeacherConductsFaceAttendanceOutputSchema = z.object({
  recognizedStudentIds: z.array(z.string()).describe('An array of IDs of students recognized in the webcam frame.'),
});
export type TeacherConductsFaceAttendanceOutput = z.infer<
  typeof TeacherConductsFaceAttendanceOutputSchema
>;

// Schema for the input to the orchestration prompt
const OrchestrationPromptInputSchema = z.object({
  action: z.literal('conductAttendance').describe('Indicates the action to conduct attendance via face recognition.'),
  webcamFrameDataUri: z.string().describe("A webcam frame as a data URI."),
  classId: z.string().describe("The ID of the class for which attendance is being taken."),
});

/**
 * Simulates a face recognition microservice that identifies students in a webcam frame.
 * In a real application, this tool would call an external Python service.
 */
const recognizeFacesTool = ai.defineTool(
  {
    name: 'recognizeFaces',
    description: 'Identifies students in a webcam frame who belong to a specific class and returns their IDs.',
    inputSchema: z.object({
      webcamFrameDataUri: z.string().describe('The webcam frame image as a data URI.'),
      classId: z.string().describe('The ID of the class to filter recognized students by.'),
    }),
    outputSchema: z.array(z.string()).describe('An array of student IDs recognized in the image.'),
  },
  async (input) => {
    // Simulate calling an external face recognition microservice.
    // In a production environment, this would involve an API call to the Python microservice.
    console.log(`[Mock Tool] Simulating face recognition for class: ${input.classId}`);
    console.log(`[Mock Tool] Processing webcam frame data URI (first 50 chars): ${input.webcamFrameDataUri.substring(0, 50)}...`);

    // Mock recognition logic: return specific student IDs based on the class ID.
    // This simulates the AI service returning matched student IDs to the backend.
    if (input.classId === 'CS101') {
      return ['student-101-alice', 'student-103-charlie'];
    } else if (input.classId === 'MA201') {
      return ['student-202-diana'];
    } else {
      // For any other class or unrecognized scenario
      return [];
    }
  }
);

const conductAttendancePrompt = ai.definePrompt({
  name: 'conductAttendancePrompt',
  tools: [recognizeFacesTool],
  input: { schema: OrchestrationPromptInputSchema },
  output: { schema: TeacherConductsFaceAttendanceOutputSchema },
  prompt: `You are an attendance assistant. When instructed to conduct attendance for a class, use the 'recognizeFaces' tool to identify students from the provided webcam frame. Ensure you pass the webcam frame data URI and class ID to the tool accurately.`, // This prompt guides the LLM to use the tool.
});

const teacherConductsFaceAttendanceFlow = ai.defineFlow(
  {
    name: 'teacherConductsFaceAttendanceFlow',
    inputSchema: TeacherConductsFaceAttendanceInputSchema,
    outputSchema: TeacherConductsFaceAttendanceOutputSchema,
  },
  async (input) => {
    // The LLM will decide to call the `recognizeFacesTool` based on the prompt instructions.
    const { output } = await conductAttendancePrompt({
      action: 'conductAttendance',
      webcamFrameDataUri: input.webcamFrameDataUri,
      classId: input.classId,
    });
    if (!output) {
      throw new Error('No output received from attendance prompt.');
    }
    return output;
  }
);

export async function teacherConductsFaceAttendance(
  input: TeacherConductsFaceAttendanceInput
): Promise<TeacherConductsFaceAttendanceOutput> {
  return teacherConductsFaceAttendanceFlow(input);
}
