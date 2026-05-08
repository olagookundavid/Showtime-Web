import os
import re

directory = 'frontend/src/pages'

# Patterns to replace only when they are likely the main wrapper
patterns = [
    (re.compile(r'className="max-w-6xl mx-auto'), 'className="max-w-7xl mx-auto'),
    (re.compile(r'className="max-w-5xl mx-auto'), 'className="max-w-7xl mx-auto'),
    (re.compile(r'className="max-w-4xl mx-auto space-y-12'), 'className="max-w-7xl mx-auto space-y-12'), # Be careful with 4xl, might be a modal
    (re.compile(r'className="space-y-6 max-w-4xl mx-auto'), 'className="space-y-6 max-w-7xl mx-auto'),
]

for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()
            
            new_content = content
            for regex, replacement in patterns:
                new_content = regex.sub(replacement, new_content)
            
            if new_content != content:
                with open(filepath, 'w') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')

