# Introduction

First, thank you for considering contributing to Node Redis! It's people like you that make the open source community such a great community! 😊

We welcome any type of contribution, not just code. You can help with:

- **QA**: file bug reports, the more details you can give the better (e.g. platform versions, screenshots, SDK versions, logs)
- **Docs**: improve reference coverage, add more examples, fix typos or anything else you can spot
- **Code**: take a look at the open issues and help triage them

---

## Project Guidelines

As maintainers of this project, we want to ensure that the project lives and continues to grow. Progress should not be blocked by any one person's availability.

One of the simplest ways of doing this is by encouraging a larger set of contributors. Using this approach we hope to mitigate the challenges of maintaining a project that needs regular updates.

### Getting Comfortable Contributing

It is normal for your first pull request to be a potential fix for a problem but moving on from there to helping the project's direction can be difficult.

We try to help contributors cross that barrier by identifying good first step issues (labelled `good-first-issue`). These issues are considered appropriate for first time contributors. Generally, these should be non-critical issues that are well defined. Established contributors will not work on these, to make space for others.

New contributors may consider picking up issues labelled `needs-triage` or `help-wanted`. These may not necessarily require code changes but rather help with debugging and finding the cause of the issue whether it's a bug or a user's incorrect setup of the library or project.

We keep all project discussion inside GitHub issues. This ensures that valuable information can be searched easily. GitHub issues are the go to tool for questions about how to use the library, or how the project is run.

### Expectations of Contributors

You shouldn't feel bad for not contributing to open source. We want contributors like yourself to provide ideas, keep the ship shipping and to take some of the load from others. It is non-obligatory; we’re here to get things done in an enjoyable way. :trophy:

We only ask that you follow the conduct guidelines set out in our [Code of Conduct](https://redis.com/community/community-guidelines-code-of-conduct/) throughout your contribution journey.


#### Special Thanks

A huge thank you to the original author of Node Redis, [Matthew Ranney](https://github.com/mranney).

---

## Code Guidelines

### Testing Code

Node Redis has a full test suite with coverage setup.

To run the tests, run `npm install` to install dependencies, then run `npm run build:tests-tools && npm test`.

Note that the test suite assumes that [`docker`](https://www.docker.com/) is installed in your environment.

### Submitting Code for Review

The bigger the pull request, the longer it will take to review and merge. Where possible try to break down large pull requests into smaller chunks that are easier to review and merge. It is also always helpful to have some context for your pull request. What was the purpose? Why does it matter to you? What problem are you trying to solve? Tag in any relevant issues.

To assist reviewers, we ask that you fill out the pull request template as much as possible.

> Use a `draft` pull request if your pull request is not complete or ready for review.

### Code Review Process

Pull Requests to the protected branches require peer-review approvals and passing status checks to be able to be merged.

When reviewing a Pull Request, please check the following steps as well as the existing automated checks:

- Does your Pull Request provide or update the docs if docs changes are required?
- Have the tests been updated or new tests been added to test any newly implemented or changed functionality?
- Is the test coverage at the same level as before (preferably more!)?
