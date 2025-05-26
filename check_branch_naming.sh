#!/usr/bin/env sh

local_branch_name="$(git rev-parse --abbrev-ref HEAD)"
error_message="[Error] There is something wrong with your branch name: $local_branch_name"

if [[ $local_branch_name =~ ^(master)$ ]]; then
    echo "\033[32m✔\033[m Branch(Master): $local_branch_name"
    exit 0
elif [[ $local_branch_name =~ ^(release\/([0-9.]+))$ ]]; then
    echo "\033[32m✔\033[m Branch(Release): $local_branch_name"
    exit 0
elif [[ $local_branch_name =~ ^(feature\/(.+))$ ]]; then
    echo "\033[32m✔\033[m Branch(Feature): $local_branch_name"
    exit 0
elif [[ $local_branch_name =~ ^(fix\/(.+))$ ]]; then
    echo "\033[32m✔\033[m Branch(Fix): $local_branch_name"
    exit 0
elif [[ $local_branch_name =~ ^(chore\/(.+))$ ]]; then
    echo "\033[32m✔\033[m Branch(Chore): $local_branch_name"
    exit 0
fi

echo "\033[31m✘\033[m $error_message"
exit 1