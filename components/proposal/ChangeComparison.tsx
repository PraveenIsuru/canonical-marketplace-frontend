import type { ProposalChange } from '@/types/proposal';

/**
 * What the record says now, against what the proposal says it should say.
 *
 * This is the whole substance of a review. A reviewer decides from these rows and
 * from what they know about the product in their own stock, and from nothing else.
 *
 * **There is no per row control**, no accept, no reject, no edit. A proposal is taken
 * or left as a whole, and a checkbox beside each row would quietly turn an all or
 * nothing decision into a partial one. That is invariant 4, and it is the reason this
 * component renders and does not interact.
 *
 * **No confidence score appears**, and none is available to render: the API sends none
 * at any access level. A reviewer who could see how the AI scored the submission would
 * be voting on the score rather than on the product.
 */
export function ChangeComparison({ changes }: { changes: ProposalChange[] }) {
  if (changes.length === 0) {
    /*
     * Not expected from the API, since a proposal exists because something differed.
     * Rendered rather than crashed, because an empty table with no explanation is the
     * worse failure.
     */
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        This proposal lists no changed fields.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <caption className="sr-only">
          The fields this proposal would change, with the current value beside the proposed one
        </caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
            <th scope="col" className="py-2 pr-4 font-medium">
              Field
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              Catalogue says now
            </th>
            <th scope="col" className="py-2 font-medium">
              Proposed
            </th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.attribute} className="border-b border-zinc-100 dark:border-zinc-900">
              <th scope="row" className="py-2 pr-4 text-left font-medium">
                {change.attribute}
              </th>
              <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-400">
                {/*
                  Null is a real case rather than missing data: a seller can describe a
                  specification the record never held. Saying so is more useful than an
                  empty cell, which reads as a rendering fault.
                */}
                {change.from ?? (
                  <span className="italic text-zinc-400 dark:text-zinc-500">nothing recorded</span>
                )}
              </td>
              <td className="py-2 font-medium">{change.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
