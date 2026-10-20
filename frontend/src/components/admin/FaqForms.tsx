import { useState, type FormEvent } from 'react';
import toast from 'react-hot-toast';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from '../ui';
import { RichTextEditor } from '../richtext';
import { FAQ_ICON_OPTIONS } from '../faq';
import type { FaqCategory, FaqCategoryPayload, FaqItem, FaqItemPayload, FaqPage, UpdateFaqPagePayload } from '../../types';

const QUESTION_MAX = 300;

interface FaqItemModalProps {
    /** The question being edited, or null for a new one. */
    item: FaqItem | null;
    categories: FaqCategory[];
    /** Category to start a new question in. */
    defaultCategoryId?: string | null;
    pending: boolean;
    onSubmit: (payload: FaqItemPayload) => void;
    onClose: () => void;
}

export const FaqItemModal = ({ item, categories, defaultCategoryId = null, pending, onSubmit, onClose }: FaqItemModalProps) => {
    const [categoryId, setCategoryId] = useState<string>(item ? item.category_id ?? '' : defaultCategoryId ?? '');
    const [question, setQuestion] = useState(item?.question ?? '');
    const [answer, setAnswer] = useState(item?.answer ?? '');
    const [isActive, setIsActive] = useState(item?.is_active ?? true);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!question.trim()) {
            toast.error('Type the question first');
            return;
        }
        if (!answer.trim()) {
            toast.error('Type the answer first');
            return;
        }
        onSubmit({ category_id: categoryId || null, question: question.trim(), answer, is_active: isActive });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={item ? 'Edit FAQ' : 'New FAQ'}
            subtitle="Visitors see the question first and open it to read the answer."
            maxWidth="2xl"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="faq-item-form" loading={pending}>Save FAQ</Button>
                </>
            }
        >
            <form id="faq-item-form" onSubmit={handleSubmit} className="space-y-4">
                {categories.length > 0 && (
                    <Field label="Category" htmlFor="faq-category" hint="Which group of questions it belongs to.">
                        <Select id="faq-category" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                            <option value="">No category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                        </Select>
                    </Field>
                )}
                <Field label={<>Question <span className="text-sffl-red">*</span></>} htmlFor="faq-question">
                    <Input
                        id="faq-question"
                        value={question}
                        onChange={e => setQuestion(e.target.value)}
                        maxLength={QUESTION_MAX}
                        placeholder="e.g. When and where are games held?"
                        required
                    />
                </Field>
                <Field label={<>Answer <span className="text-sffl-red">*</span></>} htmlFor="faq-answer">
                    <RichTextEditor id="faq-answer" variant="basic" value={answer} onChange={setAnswer} placeholder="Write the answer…" />
                </Field>
                <Checkbox
                    label="Show on the site"
                    hint="Untick to keep it saved but hide it from visitors."
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                />
            </form>
        </Modal>
    );
};

interface FaqCategoryModalProps {
    category: FaqCategory | null;
    pending: boolean;
    onSubmit: (payload: FaqCategoryPayload) => void;
    onClose: () => void;
}

export const FaqCategoryModal = ({ category, pending, onSubmit, onClose }: FaqCategoryModalProps) => {
    const [title, setTitle] = useState(category?.title ?? '');
    const [icon, setIcon] = useState(category?.icon ?? '');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Give the category a title');
            return;
        }
        onSubmit({ title: title.trim(), icon });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={category ? 'Edit Category' : 'New Category'}
            subtitle="A heading that groups related questions."
            maxWidth="md"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="faq-category-form" loading={pending}>Save Category</Button>
                </>
            }
        >
            <form id="faq-category-form" onSubmit={handleSubmit} className="space-y-4">
                <Field label={<>Title <span className="text-sffl-red">*</span></>} htmlFor="faq-cat-title">
                    <Input id="faq-cat-title" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
                </Field>
                <Field label="Icon" htmlFor="faq-cat-icon" hint="Shown beside the title in the category list.">
                    <Select id="faq-cat-icon" value={icon} onChange={e => setIcon(e.target.value)}>
                        <option value="">No icon</option>
                        {FAQ_ICON_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                </Field>
            </form>
        </Modal>
    );
};

interface FaqPageModalProps {
    /** The page being edited, or null to create one. */
    page: FaqPage | null;
    pending: boolean;
    onCreate: (payload: { key: string; name: string; path: string; description: string }) => void;
    onUpdate: (payload: UpdateFaqPagePayload) => void;
    onClose: () => void;
}

const KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const FaqPageModal = ({ page, pending, onCreate, onUpdate, onClose }: FaqPageModalProps) => {
    const [key, setKey] = useState(page?.key ?? '');
    const [name, setName] = useState(page?.name ?? '');
    const [path, setPath] = useState(page?.path ?? '');
    const [description, setDescription] = useState(page?.description ?? '');

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Give the page a name');
            return;
        }
        if (page) {
            onUpdate({ name: name.trim(), path: path.trim(), description: description.trim() });
            return;
        }
        const cleanKey = key.trim().toLowerCase();
        if (!KEY_PATTERN.test(cleanKey)) {
            toast.error('The key can only use lowercase letters, numbers and single dashes, e.g. store-faq');
            return;
        }
        onCreate({ key: cleanKey, name: name.trim(), path: path.trim(), description: description.trim() });
    };

    return (
        <Modal
            open
            onClose={onClose}
            title={page ? 'Edit Page' : 'New FAQ Page'}
            subtitle={page ? page.key : 'A place on the site that shows its own list of FAQs.'}
            maxWidth="lg"
            footer={
                <>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" form="faq-page-form" loading={pending}>{page ? 'Save Page' : 'Create Page'}</Button>
                </>
            }
        >
            <form id="faq-page-form" onSubmit={handleSubmit} className="space-y-4">
                <Field label={<>Name <span className="text-sffl-red">*</span></>} htmlFor="faq-page-name" hint="What you call it in this admin.">
                    <Input id="faq-page-name" value={name} onChange={e => setName(e.target.value)} maxLength={120} placeholder="e.g. Store" required />
                </Field>
                {!page && (
                    <Field
                        label={<>Key <span className="text-sffl-red">*</span></>}
                        htmlFor="faq-page-key"
                        hint="The short name the site asks for, e.g. store-faq. Give it to the developer who adds the FAQs to the page. It can't be changed later."
                    >
                        <Input id="faq-page-key" value={key} onChange={e => setKey(e.target.value)} maxLength={60} placeholder="store-faq" required />
                    </Field>
                )}
                <Field label="Where it appears" htmlFor="faq-page-path" hint="The address of the page, so editors know where their changes show up.">
                    <Input id="faq-page-path" value={path} onChange={e => setPath(e.target.value)} maxLength={200} placeholder="/store" />
                </Field>
                <Field label="Notes" htmlFor="faq-page-description">
                    <Textarea id="faq-page-description" value={description} onChange={e => setDescription(e.target.value)} rows={3} />
                </Field>
            </form>
        </Modal>
    );
};
