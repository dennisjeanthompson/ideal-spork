import ClockInterface from "@/components/clock/clock-interface";

export default function Clock() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Clock In/Out</h2>
        <p className="text-muted-foreground">Track your work hours and breaks</p>
      </div>
      
      <ClockInterface />
    </div>
  );
}
