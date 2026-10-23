import React, { useState, useMemo } from 'react';
import type { Task, BoardColumn } from '../../types/index.ts';
import { PriorityBadge } from '../ui/PriorityBadge.tsx';
import {
  Calendar,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { getAvatarColor, getInitials } from '../../lib/utils.ts';

interface TimelineGanttViewProps {
  tasks: Task[];
  columns: BoardColumn[];
  onOpenDetail: (taskId: string) => void;
}

export function TimelineGanttView({
  tasks,
  onOpenDetail,
}: TimelineGanttViewProps) {
  const [currentMonthOffset, setCurrentMonthOffset] = useState(0);

  const baseDate = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + currentMonthOffset);
    return d;
  }, [currentMonthOffset]);

  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = baseDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const days = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const d = new Date(year, month, dayNum);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const isToday =
        new Date().getDate() === dayNum &&
        new Date().getMonth() === month &&
        new Date().getFullYear() === year;

      return {
        dayNum,
        dayName: d.toLocaleDateString('default', { weekday: 'narrow' }),
        isWeekend,
        isToday,
      };
    });
  }, [year, month, daysInMonth]);

  const mappedTasks = useMemo(() => {
    return tasks.map((t) => {
      const created = new Date(t.created_at);
      let due = t.due_date ? new Date(t.due_date) : new Date(created.getTime() + 5 * 86400000);

      if (due < created) {
        due = new Date(created.getTime() + 86400000);
      }

      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month, daysInMonth, 23, 59, 59);

      const isVisible = due >= monthStart && created <= monthEnd;

      let startDay = 1;
      if (created.getFullYear() === year && created.getMonth() === month) {
        startDay = created.getDate();
      } else if (created > monthStart) {
        startDay = 1;
      }

      let endDay = daysInMonth;
      if (due.getFullYear() === year && due.getMonth() === month) {
        endDay = due.getDate();
      }

      const spanDays = Math.max(1, endDay - startDay + 1);

      return {
        task: t,
        isVisible,
        startDay,
        spanDays,
        isCompleted: !!t.completed_at,
        isOverdue: !t.completed_at && due < new Date(),
      };
    });
  }, [tasks, year, month, daysInMonth]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
      {/* Header controls */}
      <div className="motion-surface rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[9px] bg-[#E3EBDD] border border-[#C8D8C1] flex items-center justify-center text-[#596D56]">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-[#33382F]">Timeline Schedule</h2>
            <p className="text-[12.5px] text-[#70786D]">
              Task start and target completion windows across the month
            </p>
          </div>
        </div>

        {/* Month selector navigation */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentMonthOffset((p) => p - 1)}
            className="btn-secondary p-1.5 rounded-[9px]"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold text-[13px] text-[#33382F] min-w-36 text-center px-3 py-1.5 bg-[#F3EFE5] border border-[#DED8CB] rounded-[9px]">
            {monthName}
          </span>
          <button
            type="button"
            onClick={() => setCurrentMonthOffset((p) => p + 1)}
            className="btn-secondary p-1.5 rounded-[9px]"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {currentMonthOffset !== 0 && (
            <button
              type="button"
              onClick={() => setCurrentMonthOffset(0)}
              className="btn-tertiary text-[12px] font-semibold text-[#596D56] px-2.5 py-1.5"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Gantt Timeline Surface */}
      <div className="flex-1 motion-surface rounded-[12px] overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[900px] flex-1 flex flex-col">
            {/* Table Header */}
            <div className="flex border-b border-[#DED8CB] bg-[#F3EFE5] select-none sticky top-0 z-20">
              <div className="w-72 shrink-0 px-3.5 py-2.5 text-[11.5px] font-semibold uppercase tracking-[0.04em] text-[#70786D] border-r border-[#DED8CB]">
                Task &amp; Assignee
              </div>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(32px, 1fr))` }}
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
                  >
                    <div className="font-semibold">{d.dayNum}</div>
                    <div className="text-[9.5px] text-[#70786D]">{d.dayName}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tasks Gantt Rows */}
            <div className="overflow-y-auto divide-y divide-[#EAE4D8]">
              {mappedTasks.map(({ task, startDay, spanDays, isCompleted, isOverdue }) => (
                <div
                  key={task.id}
                  onClick={() => onOpenDetail(task.id)}
                  className="flex items-center hover:bg-[#F7F4EC] transition-colors group cursor-pointer"
                >
                  {/* Task Left Meta */}
                  <div className="w-72 shrink-0 px-3.5 py-2.5 border-r border-[#DED8CB] flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <PriorityBadge priority={task.priority} showLabel={false} />
                      <span className="text-[13px] font-semibold text-[#33382F] truncate group-hover:text-[#596D56] transition-colors">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {task.is_blocked && (
                        <span
                          className="p-1 rounded-[6px] bg-[#F3E7DD] text-[#A46F5C] border border-[#E2C8B8]"
                          title="Blocked"
                        >
                          <AlertTriangle className="w-3 h-3" />
                        </span>
                      )}
                      {task.assignees.length > 0 && (
                        <span
                          className={`w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center ${getAvatarColor(
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
                  <div
                    className="flex-1 grid relative py-2.5"
                    style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(32px, 1fr))` }}
                  >
                    {days.map((d) => (
                      <div
                        key={d.dayNum}
                        className={`h-full border-r border-[#EAE4D8] ${
                          d.isToday ? 'bg-[#E3EBDD]/40' : d.isWeekend ? 'bg-[#F3EFE5]/40' : ''
                        }`}
                      />
                    ))}

                    <div
                      style={{
                        gridColumnStart: startDay,
                        gridColumnEnd: `span ${spanDays}`,
                      }}
                      className={`absolute top-2 bottom-2 rounded-[6px] px-2.5 flex items-center gap-1.5 text-[11.5px] font-medium border transition-all ${
                        isCompleted
                          ? 'bg-[#E6EEE4] text-[#35513A] border-[#C8D8C1]'
                          : task.is_blocked
                          ? 'bg-[#F3E7DD] text-[#7B4B3A] border-[#DFC2B0]'
                          : isOverdue
                          ? 'bg-[#F3E7DD] text-[#985C51] border-[#DFC2B0]'
                          : 'bg-[#E3EBDD] text-[#33382F] border-[#C8D8C1]'
                      }`}
                      title={`${task.title} (${spanDays} days)`}
                    >
                      <span className="truncate font-semibold">{task.title}</span>
                      {task.time_spent_hours ? (
                        <span className="text-[10.5px] opacity-80 shrink-0" data-tabular-nums="true">
                          {task.time_spent_hours}h
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {mappedTasks.length === 0 && (
                <div className="py-16 text-center text-[#70786D] text-[13px]">
                  No tasks scheduled in this timeline window.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
