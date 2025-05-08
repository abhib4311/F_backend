export async function nextSequence(prisma, sequenceName, prefix, padding) {
  try {
    const updatedCounter = await prisma.counter.upsert({
      where: { sequence_name: sequenceName },
      update: { sequence_value: { increment: 1 } },
      create: { sequence_name: sequenceName, sequence_value: 1 },
    });

    const sequenceNumber = String(updatedCounter.sequence_value).padStart(
      padding,
      "0"
    );

    return `${prefix}${sequenceNumber}`;
  } catch (error) {
    console.error("Error generating sequence:", error);
    throw new ResponseError(500, "Failed to generate customer sequence number");
  }
}