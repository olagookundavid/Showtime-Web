import type { Order } from '../../services/api';

type StepState = 'done' | 'current' | 'upcoming';

type Step = {
    label: string;
    state: StepState;
};

const stepsForOrder = (order: Order): Step[] => {
    const payment = order.payment_status;
    const fulfillment = order.fulfillment_status;

    // 1. Order Placed — true the moment the row exists, so always done.
    // 2. Paid — done when payment lands; current while pending.
    // 3. Preparing — current once paid and fulfillment is still pending.
    // 4. Shipped — current while in-transit; done after delivery.
    // 5. Delivered — done when fulfillment hits the final state.
    const paidState: StepState =
        payment === 'paid' ? 'done' : payment === 'pending' ? 'current' : 'upcoming';

    const preparingState: StepState =
        fulfillment === 'shipped' || fulfillment === 'delivered' ? 'done'
            : payment === 'paid' && fulfillment === 'pending' ? 'current'
                : 'upcoming';

    const shippedState: StepState =
        fulfillment === 'delivered' ? 'done'
            : fulfillment === 'shipped' ? 'current'
                : 'upcoming';

    const deliveredState: StepState = fulfillment === 'delivered' ? 'done' : 'upcoming';

    return [
        { label: 'Order Placed', state: 'done' },
        { label: 'Paid', state: paidState },
        { label: 'Preparing', state: preparingState },
        { label: 'Shipped', state: shippedState },
        { label: 'Delivered', state: deliveredState },
    ];
};

const circleClass = (state: StepState): string => {
    switch (state) {
        case 'done':
            return 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30';
        case 'current':
            return 'bg-white dark:bg-gray-900 border-sffl-red text-sffl-red ring-4 ring-sffl-red/20 animate-pulse';
        case 'upcoming':
        default:
            return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-400';
    }
};

const connectorClass = (leftState: StepState, rightState: StepState): string => {
    // Connector turns green only when BOTH ends are done — otherwise the
    // segment is still in-progress (visualized as grey).
    if (leftState === 'done' && rightState !== 'upcoming') {
        return 'bg-emerald-500';
    }
    return 'bg-gray-200 dark:bg-gray-700';
};

type Props = { order: Order };

export const OrderLifecycleStepper = ({ order }: Props) => {
    // Terminal states get their own banner — a progress bar on a dead order
    // would mislead the customer.
    if (order.payment_status === 'failed') {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-2xl p-5 flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">❌</div>
                <div className="space-y-1">
                    <h3 className="font-black text-red-700 dark:text-red-300 uppercase tracking-wider text-sm">Payment Failed</h3>
                    <p className="text-xs text-red-700/80 dark:text-red-300/80 leading-relaxed">
                        Your payment didn't go through, so no order has been placed. If money left your account, please contact us — we'll trace it within one business day.
                    </p>
                </div>
            </div>
        );
    }

    if (order.fulfillment_status === 'cancelled') {
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-2xl p-5 flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">🚫</div>
                <div className="space-y-1">
                    <h3 className="font-black text-red-700 dark:text-red-300 uppercase tracking-wider text-sm">Order Cancelled</h3>
                    <p className="text-xs text-red-700/80 dark:text-red-300/80 leading-relaxed">
                        This order has been cancelled. If you were charged, a refund will be processed via Paystack within 15 business days.
                    </p>
                </div>
            </div>
        );
    }

    const steps = stepsForOrder(order);

    return (
        <div className="bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-[10px] uppercase font-black tracking-widest text-sffl-navy dark:text-gray-400 mb-5">Order Status</h3>

            {/* Stepper. Steps render as a flex row; on narrow screens the labels
                tuck under the circles and overflow if needed but the row itself
                doesn't wrap — keeps the timeline readable left-to-right. */}
            <div className="flex items-start">
                {steps.map((step, i) => (
                    <div
                        key={step.label}
                        className={`flex items-start ${i < steps.length - 1 ? 'flex-1' : 'flex-initial'}`}
                    >
                        {/* Circle + label column */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0 w-16 sm:w-20">
                            <div
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 flex items-center justify-center transition-all ${circleClass(step.state)}`}
                                aria-label={`${step.label}: ${step.state}`}
                            >
                                {step.state === 'done' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className="text-xs font-black">{i + 1}</span>
                                )}
                            </div>
                            <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-center leading-tight ${
                                step.state === 'upcoming' ? 'text-gray-400' : 'text-sffl-navy dark:text-white'
                            }`}>
                                {step.label}
                            </span>
                        </div>

                        {/* Connector to the next step */}
                        {i < steps.length - 1 && (
                            <div className="flex-1 h-9 sm:h-10 flex items-center px-1 sm:px-2">
                                <div className={`h-1 w-full rounded-full transition-colors ${connectorClass(step.state, steps[i + 1].state)}`} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
