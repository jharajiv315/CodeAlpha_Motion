import React, { useState, useMemo } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getAvatarColor, getInitials, formatDate } from '../../lib/utils.ts';

interface TimelineGanttViewProps {
  tasks: Task[];
  columns: BoardColumn[];
  onOpenDetail: (taskId: string) => void;
}

export function TimelineGanttView({
  tasks,
  columns,
  onOpenDetail,
}: TimelineGanttViewProps) {
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + currentMonthOffset);
    return d;
  }, [currentMonthOffset]);

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = baseDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    const now = new Date();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const d = new Date(year, month, dayNum);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday =
        now.getDate() === dayNum &&
        now.getMonth() === month &&
        now.getFullYear() === year;

      return {
        dayNum,
        dayName: d.toLocaleDateString('default', { weekday: 'narrow' }),
        isWeekend,
        isToday,
      };
    });
  }, [year, month, daysInMonth]);

  const columnMap = useMemo(() => {
    const map: Record<string, string> = {};
    columns.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [columns]);

  const mappedTasks = useMemo(() => {
    const monthStart = new Date(year, month, 1, 0, 0, 0);
    const monthEnd = new Date(year, month, daysInMonth, 23, 59, 59);

    return tasks.map((t) => {
      const created = new Date(t.created_at);
      let due = t.due_date ? new Date(t.due_date) : new Date(created.getTime() + 5 * 86400000);

      if (due < created) {
        due = new Date(created.getTime() + 2 * 86400000);
      }

      // Clamp to current month window for visual schedule display
      const overlapsMonth = due >= monthStart && created <= monthEnd;

      let startDay = 1;
      let endDay = Math.min(daysInMonth, 6);

      if (overlapsMonth) {
        startDay =
          created < monthStart
            ? 1
            : Math.max(1, Math.min(daysInMonth, created.getDate()));
        endDay =
          due > monthEnd
            ? daysInMonth
            : Math.max(startDay, Math.min(daysInMonth, due.getDate()));
      } else {
        // Fallback position based on due/created day of month so tasks remain inspectable
        startDay = Math.max(1, Math.min(daysInMonth - 3, created.getDate()));
        endDay = Math.max(startDay + 2, Math.min(daysInMonth, due.getDate()));
      }

      const spanDays = Math.max(2, endDay - startDay + 1);
      const colName = columnMap[t.column_id] || 'Task';
      const isDoneCol = colName.toLowerCase().includes('done');

      return {
        task: t,
        colName,
        startDay,
        spanDays,
        dueDateObj: due,
        isCompleted: !!t.completed_at || isDoneCol,
        isOverdue: !t.completed_at && !isDoneCol && due < new Date(),
      };
    });
  }, [tasks, year, month, daysInMonth, columnMap]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden px-6 md:px-8 py-5 space-y-4 animate-view-in">
      {/* Header controls */}
      <div className="motion-surface rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[9px] bg-[#E3EBDD] border border-[#C8D8C1] flex items-center justify-center text-[#596D56]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-[#33382F]">Timeline Schedule</h2>
            <p className="text-[12px] text-[#70786D]">
              Task start and target completion windows across {monthName}
            </p>
          </div>
        </div>

        {/* Legend & Month selector navigation */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="hidden lg:flex items-center gap-3 text-[11.5px] text-[#5D655A]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#E3EBDD] border border-[#9BB096]" />
              <span>Active</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#F3E7DD] border border-[#A46F5C]" />
              <span>Blocked / Overdue</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[#E6EEE4] border border-[#62866B]" />
              <span>Completed</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((p) => p - 1)}
              className="btn-secondary p-1.5 rounded-[9px] cursor-pointer"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              className="font-semibold text-[12.5px] text-[#33382F] min-w-36 text-center px-3 py-1.5 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px]"
              data-tabular-nums="true"
            >
              {monthName}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonthOffset((p) => p + 1)}
              className="btn-secondary p-1.5 rounded-[9px] cursor-pointer"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {currentMonthOffset !== 0 && (
              <button
                type="button"
                onClick={() => setCurrentMonthOffset(0)}
                className="btn-tertiary text-[12px] font-semibold text-[#596D56] px-2.5 py-1.5 cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gantt Timeline Surface */}
      <div className="flex-1 motion-surface rounded-[12px] overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 flex flex-col">
          <div className="min-w-[980px] flex-1 flex flex-col">
            {/* Table Header */}
            <div className="flex border-b border-[#DED8CB] bg-[#F3EFE5] select-none sticky top-0 z-20">
              <div className="w-80 shrink-0 px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#70786D] border-r border-[#DED8CB] flex items-center justify-between">
                <span>Task</span>
                <span>Stage</span>
              </div>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))` }}
              >
                {days.map((d) => (
                  <div
                    key={d.dayNum}
                    className={`py-2 text-center border-r border-[#EAE4D8] text-[10.5px] ${
                      d.isToday
                        ? 'bg-[#E3EBDD] font-bold text-[#3C513A]'
                        : d.isWeekend
                        ? 'bg-[#EDE7DA]/60 text-[#70786D]'
                        : 'text-[#5D655A]'
                    }`}
                    data-tabular-nums="true"
                  >
                    <div className="font-semibold">{d.dayNum}</div>
                    <div className="text-[9.5px] text-[#70786D]">{d.dayName}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Gantt Rows */}
            <div className="divide-y divide-[#EAE4D8] flex-1">
              {mappedTasks.map(({ task, colName, startDay, spanDays, dueDateObj, isCompleted, isOverdue }) => (
                <div
                  key={task.id}
                  onClick={() => onOpenDetail(task.id)}
                  className="flex items-stretch hover:bg-[#F7F4EC] transition-colors group cursor-pointer min-h-[46px]"
                >
                  {/* Task Left Meta */}
                  <div className="w-80 shrink-0 px-4 py-2.5 border-r border-[#DED8CB] flex items-center justify-between gap-2 bg-[#FFFCF6] group-hover:bg-[#F7F4EC] transition-colors">
                    <div className="min-w-0 flex items-center gap-2">
                      <PriorityBadge priority={task.priority} showLabel={false} />
                      <span className="text-[13px] font-semibold text-[#33382F] truncate group-hover:text-[#596D56] transition-colors">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.is_blocked && (
                        <span
                          className="p-1 rounded-[5px] bg-[#F3E7DD] text-[#A46F5C] border border-[#E2C8B8]"
                          title="Blocked"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                      <span className="text-[11px] text-[#5D655A] bg-[#F3EFE5] border border-[#DED8CB] px-2 py-0.5 rounded-[5px] font-medium">
                        {colName}
                      </span>
                      {task.assignees.length > 0 && (
                        <span
                          className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${getAvatarColor(
                            task.assignees[0].name
                          )}`}
                          title={task.assignees[0].name}
                        >
                          {getInitials(task.assignees[0].name)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Gantt Bar Grid Track */}
                  <div className="flex-1 relative flex items-center">
                    {/* Background day grid cells */}
                    <div
                      className="absolute inset-0 grid pointer-events-none"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))` }}
                    >
                      {days.map((d) => (
                        <div
                          key={d.dayNum}
                          className={`h-full border-r border-[#EAE4D8] ${
                            d.isToday
                              ? 'bg-[#E3EBDD]/45'
                              : d.isWeekend
                              ? 'bg-[#F3EFE5]/45'
                              : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Foreground Grid Item Bar */}
                    <div
                      className="relative z-10 w-full grid py-2"
                      style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(28px, 1fr))` }}
                    >
                      <div
                        style={{
                          gridColumn: `${startDay} / span ${spanDays}`,
                        }}
                        className={`mx-1 h-7 rounded-[6px] px-2.5 flex items-center justify-between gap-2 text-[11.5px] font-medium border shadow-2xs transition-transform group-hover:scale-[1.01] ${
                          isCompleted
                            ? 'bg-[#E6EEE4] text-[#35513A] border-[#B4C9AE]'
                            : task.is_blocked
                            ? 'bg-[#F3E7DD] text-[#7B4B3A] border-[#D9B6A3]'
                            : isOverdue
                            ? 'bg-[#F3E7DD] text-[#985C51] border-[#D9B6A3]'
                            : 'bg-[#E3EBDD] text-[#33382F] border-[#B8CBB0]'
                        }`}
                        title={`${task.title} · Due ${formatDate(dueDateObj.toISOString())}`}
                      >
                        <span className="truncate font-semibold">{task.title}</span>
                        <span className="text-[10.5px] opacity-80 shrink-0" data-tabular-nums="true">
                          {task.time_spent_hours ? `${task.time_spent_hours}h` : `${spanDays}d`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {mappedTasks.length === 0 && (
                <div className="py-16 text-center text-[#70786D] text-[13px]">
                  No tasks scheduled in this project yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
